use rand::prelude::*;
use std::collections::{HashMap, HashSet};

use crate::simulation::resolver::{
    ActionCommand, Cell, MatchState, ResolverError, Sector, UnitA, UnitRCommand, FIELD_COLS,
    FIELD_ROWS,
};

const BOT_UNIT_COUNT: usize = 5;
const BOT_UNIT_HP: i32 = 10;
const BOT_UNITR_COUNT: usize = 4;

#[derive(Debug, Clone)]
pub struct Bot {
    sector: Sector,
    rng: StdRng,
    scouted_cells: HashSet<Cell>,
    unit_ids: Vec<u32>,
}

impl Bot {
    pub fn new(sector: Sector, seed: u64) -> Self {
        Self {
            sector,
            rng: StdRng::seed_from_u64(seed),
            scouted_cells: HashSet::new(),
            unit_ids: Vec::new(),
        }
    }

    pub fn take_turn(&mut self, state: &mut MatchState) -> Result<(), ResolverError> {
        self.update_scouted(state);
        if state.round == 0 {
            self.place_initial_units(state);
            self.assign_unitr_round_zero(state)?;
            return Ok(());
        }

        let attack_targets = self.queue_actions(state)?;
        self.assign_unitr_rounds(state, &attack_targets)?;
        Ok(())
    }

    fn update_scouted(&mut self, state: &MatchState) {
        if state.active_recon.contains(&self.sector) {
            self.scouted_cells.extend(cells_for_sector(self.sector));
        }
        if state.active_recon.contains(&opponent_sector(self.sector)) {
            self.scouted_cells
                .extend(cells_for_sector(opponent_sector(self.sector)));
        }
    }

    fn place_initial_units(&mut self, state: &mut MatchState) {
        if !self.unit_ids.is_empty() {
            return;
        }

        let mut cells = cells_for_sector(self.sector);
        cells.shuffle(&mut self.rng);
        let start_id = state.units.iter().map(|unit| unit.id).max().unwrap_or(0) + 1;

        for (offset, cell) in cells.into_iter().take(BOT_UNIT_COUNT).enumerate() {
            let unit_id = start_id + offset as u32;
            state.units.push(UnitA {
                id: unit_id,
                hp: BOT_UNIT_HP,
                cell,
            });
            self.unit_ids.push(unit_id);
        }
    }

    fn assign_unitr_round_zero(&mut self, state: &mut MatchState) -> Result<(), ResolverError> {
        let opponent = opponent_sector(self.sector);
        let available_cells = cells_for_sector(opponent);
        let mut counts: HashMap<Cell, usize> = HashMap::new();

        let mut placements = Vec::new();
        while placements.len() < BOT_UNITR_COUNT {
            let cell = *available_cells.choose(&mut self.rng).expect("sector cells");
            let count = counts.entry(cell).or_insert(0);
            if *count >= 2 {
                continue;
            }
            *count += 1;
            placements.push(cell);
        }

        for cell in placements {
            state.queue_unitr(UnitRCommand::Block {
                cell,
                delay_rounds: 0,
            })?;
        }
        Ok(())
    }

    fn queue_actions(&mut self, state: &mut MatchState) -> Result<Vec<Cell>, ResolverError> {
        let mut attack_targets = Vec::new();
        let possible_attack_targets = self.attack_targets(state);
        let bot_units: Vec<UnitA> = state
            .units
            .iter()
            .filter(|unit| Sector::for_cell(unit.cell) == Some(self.sector) && unit.hp > 0)
            .cloned()
            .collect();

        for unit in bot_units {
            let mut actions = vec!["none"];
            if !possible_attack_targets.is_empty() {
                actions.push("attack");
            }

            let move_targets = self.move_targets(state, unit.cell);
            if !move_targets.is_empty() {
                actions.push("move");
            }

            let choice = actions.choose(&mut self.rng).copied().unwrap_or("none");
            match choice {
                "attack" => {
                    if let Some(target) = possible_attack_targets.choose(&mut self.rng) {
                        attack_targets.push(*target);
                        state.queue_action(ActionCommand::Attack {
                            unit_id: unit.id,
                            target: *target,
                            damage: 1,
                            delay_rounds: 0,
                        })?;
                    }
                }
                "move" => {
                    if let Some(target) = move_targets.choose(&mut self.rng) {
                        state.queue_action(ActionCommand::Move {
                            unit_id: unit.id,
                            to: *target,
                            delay_rounds: 0,
                        })?;
                    }
                }
                _ => {}
            }
        }

        Ok(attack_targets)
    }

    fn attack_targets(&self, state: &MatchState) -> Vec<Cell> {
        let opponent = opponent_sector(self.sector);
        let scouted_cells: Vec<Cell> = self
            .scouted_cells
            .iter()
            .copied()
            .filter(|cell| Sector::for_cell(*cell) == Some(opponent))
            .filter(|cell| state.field.cell_hp(*cell).unwrap_or(0) > 0)
            .collect();

        if scouted_cells.is_empty() {
            return Vec::new();
        }

        let max_hp = scouted_cells
            .iter()
            .filter_map(|cell| state.field.cell_hp(*cell))
            .max()
            .unwrap_or(0);
        let mut fattest: Vec<Cell> = scouted_cells
            .iter()
            .copied()
            .filter(|cell| state.field.cell_hp(*cell).unwrap_or(0) == max_hp)
            .collect();
        fattest.shuffle(&mut self.rng);

        let center = match fattest.first() {
            Some(cell) => *cell,
            None => return Vec::new(),
        };

        neighbors_3x3(center)
            .into_iter()
            .filter(|cell| self.scouted_cells.contains(cell))
            .filter(|cell| Sector::for_cell(*cell) == Some(opponent))
            .filter(|cell| cell.in_bounds())
            .collect()
    }

    fn move_targets(&self, state: &MatchState, current: Cell) -> Vec<Cell> {
        self.scouted_cells
            .iter()
            .copied()
            .filter(|cell| *cell != current)
            .filter(|cell| Sector::for_cell(*cell) == Some(self.sector))
            .filter(|cell| self.is_move_valid(state, current, *cell))
            .collect()
    }

    fn is_move_valid(&self, state: &MatchState, current: Cell, target: Cell) -> bool {
        if !target.in_bounds() {
            return false;
        }
        if state.active_blocks.contains(&target) {
            return false;
        }
        if state.field.cell_hp(target).unwrap_or(0) <= 0 {
            return false;
        }
        let current_sector = Sector::for_cell(current);
        let target_sector = Sector::for_cell(target);
        current_sector.is_some() && current_sector == target_sector
    }

    fn assign_unitr_rounds(
        &mut self,
        state: &mut MatchState,
        attack_targets: &[Cell],
    ) -> Result<(), ResolverError> {
        let mut remaining = BOT_UNITR_COUNT;
        let opponent = opponent_sector(self.sector);

        if remaining > 0 && !self.has_scouted_sector(opponent) {
            state.queue_unitr(UnitRCommand::Recon {
                sector: opponent,
                delay_rounds: 0,
            })?;
            remaining -= 1;
        }

        let mut block_cells: Vec<Cell> = attack_targets
            .iter()
            .flat_map(|cell| neighbors_3x3(*cell))
            .filter(|cell| Sector::for_cell(*cell) == Some(opponent))
            .filter(|cell| self.scouted_cells.contains(cell))
            .collect();
        block_cells.sort_by_key(|cell| (cell.row, cell.col));
        block_cells.dedup();
        block_cells.shuffle(&mut self.rng);

        for cell in block_cells.into_iter().take(remaining) {
            state.queue_unitr(UnitRCommand::Block {
                cell,
                delay_rounds: 0,
            })?;
            remaining -= 1;
            if remaining == 0 {
                return Ok(());
            }
        }

        let mut fallback_cells: Vec<Cell> = self
            .scouted_cells
            .iter()
            .copied()
            .filter(|cell| Sector::for_cell(*cell) == Some(opponent))
            .collect();
        fallback_cells.shuffle(&mut self.rng);

        for cell in fallback_cells.into_iter().take(remaining) {
            state.queue_unitr(UnitRCommand::Block {
                cell,
                delay_rounds: 0,
            })?;
        }

        Ok(())
    }

    fn has_scouted_sector(&self, sector: Sector) -> bool {
        self.scouted_cells
            .iter()
            .any(|cell| Sector::for_cell(*cell) == Some(sector))
    }
}

fn opponent_sector(sector: Sector) -> Sector {
    match sector {
        Sector::Left => Sector::Right,
        Sector::Right => Sector::Left,
    }
}

fn cells_for_sector(sector: Sector) -> Vec<Cell> {
    let mut cells = Vec::new();
    for row in 0..FIELD_ROWS {
        for col in 0..FIELD_COLS {
            let cell = Cell { row, col };
            if Sector::for_cell(cell) == Some(sector) {
                cells.push(cell);
            }
        }
    }
    cells
}

fn neighbors_3x3(center: Cell) -> Vec<Cell> {
    let mut cells = Vec::new();
    for dr in -1..=1 {
        for dc in -1..=1 {
            let row = center.row as isize + dr;
            let col = center.col as isize + dc;
            if row < 0 || col < 0 {
                continue;
            }
            let cell = Cell {
                row: row as usize,
                col: col as usize,
            };
            if cell.in_bounds() {
                cells.push(cell);
            }
        }
    }
    cells
}
