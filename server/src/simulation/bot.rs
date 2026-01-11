use rand::prelude::*;
use std::collections::{HashMap, HashSet};

use crate::simulation::resolver::{
    ActionCommand, Cell, MatchState, ResolverError, Sector, UnitA, UnitRCommand, FIELD_COLS,
    FIELD_ROWS, MAX_UNITR_PER_CELL,
};

const BOT_UNIT_COUNT: usize = 5;
const BOT_UNIT_HP: i32 = 5;
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

        let attack_target = self.queue_actions(state)?;
        self.assign_unitr_rounds(state, attack_target)?;
        Ok(())
    }

    fn update_scouted(&mut self, state: &MatchState) {
        self.scouted_cells
            .extend(state.scouted_cells.iter().copied());
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
        let available_cells: Vec<Cell> = cells_for_sector(opponent)
            .into_iter()
            .filter(|cell| state.field.cell_hp(*cell).unwrap_or(0) > 0)
            .collect();
        let mut counts: HashMap<Cell, usize> = HashMap::new();

        let mut placements = Vec::new();
        while placements.len() < BOT_UNITR_COUNT {
            let cell = *available_cells.choose(&mut self.rng).expect("sector cells");
            let count = counts.entry(cell).or_insert(0usize);
            if *count >= MAX_UNITR_PER_CELL {
                continue;
            }
            *count += 1;
            placements.push(cell);
        }

        for cell in placements {
            state.queue_unitr(UnitRCommand::Assign { cell })?;
        }
        Ok(())
    }

    fn queue_actions(&mut self, state: &mut MatchState) -> Result<Option<Cell>, ResolverError> {
        let mut attack_target = self.attack_target(state);
        let bot_units: Vec<UnitA> = state
            .units
            .iter()
            .filter(|unit| Sector::for_cell(unit.cell) == Some(self.sector) && unit.hp > 0)
            .cloned()
            .collect();

        let mut grouped_units: HashMap<Cell, Vec<u32>> = HashMap::new();
        for unit in bot_units {
            grouped_units.entry(unit.cell).or_default().push(unit.id);
        }

        for (cell, unit_ids) in grouped_units {
            let mut actions = vec!["none"];
            if attack_target.is_some() {
                actions.push("attack");
            }

            let move_targets = self.move_targets(state, cell);
            if !move_targets.is_empty() {
                actions.push("move");
            }

            let choice = actions.choose(&mut self.rng).copied().unwrap_or("none");
            match choice {
                "attack" => {
                    if let Some(target) = attack_target {
                        let packet = self.select_packet(&unit_ids);
                        state.queue_action(ActionCommand::Attack {
                            unit_ids: packet,
                            target,
                        })?;
                    }
                }
                "move" => {
                    if let Some(target) = move_targets.choose(&mut self.rng) {
                        let packet = self.select_packet(&unit_ids);
                        state.queue_action(ActionCommand::Move {
                            unit_ids: packet,
                            to: *target,
                        })?;
                    }
                }
                _ => {}
            }
        }

        Ok(attack_target)
    }

    fn attack_target(&self, state: &MatchState) -> Option<Cell> {
        let opponent = opponent_sector(self.sector);
        let mut cell_hp_map: HashMap<Cell, i32> = HashMap::new();
        for unit in state
            .units
            .iter()
            .filter(|unit| Sector::for_cell(unit.cell) == Some(opponent) && unit.hp > 0)
        {
            if !self.scouted_cells.contains(&unit.cell) {
                continue;
            }
            *cell_hp_map.entry(unit.cell).or_insert(0) += unit.hp;
        }

        if cell_hp_map.is_empty() {
            return None;
        }

        let max_hp = cell_hp_map.values().copied().max().unwrap_or(0);
        let mut fattest: Vec<Cell> = cell_hp_map
            .iter()
            .filter(|(_, hp)| **hp == max_hp)
            .map(|(cell, _)| *cell)
            .collect();
        fattest.shuffle(&mut self.rng);

        let center = *fattest.first()?;

        let mut candidates: Vec<Cell> = neighbors_3x3(center)
            .into_iter()
            .filter(|cell| Sector::for_cell(*cell) == Some(opponent))
            .filter(|cell| cell.in_bounds())
            .filter(|cell| state.field.cell_hp(*cell).unwrap_or(0) > 0)
            .collect();
        candidates.shuffle(&mut self.rng);
        candidates.first().copied()
    }

    fn move_targets(&self, state: &MatchState, current: Cell) -> Vec<Cell> {
        neighbors_3x3(current)
            .into_iter()
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
        attack_target: Option<Cell>,
    ) -> Result<(), ResolverError> {
        let opponent = opponent_sector(self.sector);
        let mut remaining = BOT_UNITR_COUNT;
        let mut assigned: HashMap<Cell, usize> = HashMap::new();

        while remaining > 0 {
            let should_block = remaining >= 2 && self.rng.gen_bool(0.5);
            let mut candidate_cells: Vec<Cell> = match attack_target {
                Some(center) => neighbors_3x3(center)
                    .into_iter()
                    .filter(|cell| Sector::for_cell(*cell) == Some(opponent))
                    .collect(),
                None => cells_for_sector(opponent),
            };
            candidate_cells.shuffle(&mut self.rng);
            let cell = match candidate_cells
                .into_iter()
                .find(|cell| state.field.cell_hp(*cell).unwrap_or(0) > 0)
            {
                Some(cell) => cell,
                None => break,
            };

            let existing = assigned.get(&cell).copied().unwrap_or(0);
            if existing >= MAX_UNITR_PER_CELL {
                continue;
            }

            state.queue_unitr(UnitRCommand::Assign { cell })?;
            *assigned.entry(cell).or_insert(0) += 1;
            remaining -= 1;

            if should_block && remaining > 0 && assigned.get(&cell).copied().unwrap_or(0) < 2 {
                state.queue_unitr(UnitRCommand::Assign { cell })?;
                *assigned.entry(cell).or_insert(0) += 1;
                remaining -= 1;
            }
        }

        Ok(())
    }

    fn select_packet(&mut self, unit_ids: &[u32]) -> Vec<u32> {
        if unit_ids.len() <= 1 {
            return unit_ids.to_vec();
        }
        if self.rng.gen_bool(0.6) {
            return unit_ids.to_vec();
        }
        let count = self.rng.gen_range(1..=unit_ids.len());
        let mut ids = unit_ids.to_vec();
        ids.shuffle(&mut self.rng);
        ids.truncate(count);
        ids
    }
}

fn opponent_sector(sector: Sector) -> Sector {
    match sector {
        Sector::Top => Sector::Bottom,
        Sector::Bottom => Sector::Top,
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
