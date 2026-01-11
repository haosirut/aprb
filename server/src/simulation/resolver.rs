use std::collections::{HashMap, HashSet};

pub const FIELD_ROWS: usize = 5;
pub const FIELD_COLS: usize = 10;
pub const SECTOR_COLS: usize = 5;
pub const MAX_TIMER_ROUNDS: u32 = 3;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct Cell {
    pub row: usize,
    pub col: usize,
}

impl Cell {
    pub fn in_bounds(self) -> bool {
        self.row < FIELD_ROWS && self.col < FIELD_COLS
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Sector {
    Left,
    Right,
}

impl Sector {
    pub fn for_cell(cell: Cell) -> Option<Self> {
        if cell.row >= FIELD_ROWS {
            return None;
        }
        match cell.col {
            0..=4 => Some(Sector::Left),
            5..=9 => Some(Sector::Right),
            _ => None,
        }
    }
}

#[derive(Debug, Clone)]
pub struct UnitA {
    pub id: u32,
    pub hp: i32,
    pub cell: Cell,
}

#[derive(Debug, Clone)]
pub struct FieldState {
    pub cell_hp: [[i32; FIELD_COLS]; FIELD_ROWS],
}

impl FieldState {
    pub fn new(default_hp: i32) -> Self {
        Self {
            cell_hp: [[default_hp; FIELD_COLS]; FIELD_ROWS],
        }
    }

    pub fn cell_hp(&self, cell: Cell) -> Option<i32> {
        if cell.in_bounds() {
            Some(self.cell_hp[cell.row][cell.col])
        } else {
            None
        }
    }

    pub fn apply_damage(&mut self, cell: Cell, damage: i32) {
        if !cell.in_bounds() {
            return;
        }
        let hp = &mut self.cell_hp[cell.row][cell.col];
        *hp = (*hp - damage).max(0);
    }
}

#[derive(Debug, Clone)]
pub enum ActionCommand {
    Move {
        unit_id: u32,
        to: Cell,
        delay_rounds: u32,
    },
    Attack {
        unit_id: u32,
        target: Cell,
        damage: i32,
        delay_rounds: u32,
    },
}

#[derive(Debug, Clone)]
pub enum UnitRCommand {
    Recon { sector: Sector, delay_rounds: u32 },
    Block { cell: Cell, delay_rounds: u32 },
}

#[derive(Debug, Clone)]
struct QueuedAction {
    execute_round: u32,
    command: ActionCommand,
}

#[derive(Debug, Clone)]
struct QueuedUnitR {
    execute_round: u32,
    command: UnitRCommand,
}

#[derive(Debug, Clone)]
pub struct MatchState {
    pub round: u32,
    pub field: FieldState,
    pub units: Vec<UnitA>,
    pub active_recon: HashSet<Sector>,
    pub active_blocks: HashSet<Cell>,
    pending_actions: Vec<QueuedAction>,
    pending_unitr: Vec<QueuedUnitR>,
    next_recon: HashSet<Sector>,
    next_blocks: HashSet<Cell>,
}

impl MatchState {
    pub fn new(default_cell_hp: i32) -> Self {
        Self {
            round: 0,
            field: FieldState::new(default_cell_hp),
            units: Vec::new(),
            active_recon: HashSet::new(),
            active_blocks: HashSet::new(),
            pending_actions: Vec::new(),
            pending_unitr: Vec::new(),
            next_recon: HashSet::new(),
            next_blocks: HashSet::new(),
        }
    }

    pub fn queue_action(&mut self, command: ActionCommand) -> Result<(), ResolverError> {
        let (delay_rounds, execute_round) = match &command {
            ActionCommand::Move { delay_rounds, .. }
            | ActionCommand::Attack { delay_rounds, .. } => {
                (*delay_rounds, self.round + delay_rounds)
            }
        };
        if delay_rounds > MAX_TIMER_ROUNDS {
            return Err(ResolverError::TimerTooLong);
        }
        self.pending_actions.push(QueuedAction {
            execute_round,
            command,
        });
        Ok(())
    }

    pub fn queue_unitr(&mut self, command: UnitRCommand) -> Result<(), ResolverError> {
        let (delay_rounds, execute_round) = match &command {
            UnitRCommand::Recon { delay_rounds, .. } | UnitRCommand::Block { delay_rounds, .. } => {
                (*delay_rounds, self.round + delay_rounds)
            }
        };
        if delay_rounds > MAX_TIMER_ROUNDS {
            return Err(ResolverError::TimerTooLong);
        }
        self.pending_unitr.push(QueuedUnitR {
            execute_round,
            command,
        });
        Ok(())
    }

    pub fn resolve_round(&mut self) {
        self.active_recon = std::mem::take(&mut self.next_recon);
        self.active_blocks = std::mem::take(&mut self.next_blocks);

        let mut moves: Vec<(usize, Cell)> = Vec::new();
        let mut damage_map: HashMap<Cell, i32> = HashMap::new();

        let mut remaining_actions = Vec::new();
        for queued in self.pending_actions.drain(..) {
            if queued.execute_round == self.round {
                match &queued.command {
                    ActionCommand::Move { unit_id, to, .. } => {
                        if let Some(index) = self.find_unit_index(*unit_id) {
                            if self.is_move_valid(index, *to) {
                                moves.push((index, *to));
                            }
                        }
                    }
                    ActionCommand::Attack {
                        unit_id,
                        target,
                        damage,
                        ..
                    } => {
                        if self.find_unit_index(*unit_id).is_some() && target.in_bounds() {
                            *damage_map.entry(*target).or_insert(0) += *damage;
                        }
                    }
                }
            } else if queued.execute_round > self.round {
                remaining_actions.push(queued);
            }
        }
        self.pending_actions = remaining_actions;

        for (index, target) in moves {
            self.units[index].cell = target;
        }

        for (target, total_damage) in damage_map {
            if total_damage <= 0 {
                continue;
            }
            if self.apply_damage_to_units(target, total_damage) {
                continue;
            }
            self.field.apply_damage(target, total_damage);
        }

        let mut remaining_unitr = Vec::new();
        for queued in self.pending_unitr.drain(..) {
            if queued.execute_round == self.round {
                match &queued.command {
                    UnitRCommand::Recon { sector, .. } => {
                        self.next_recon.insert(*sector);
                    }
                    UnitRCommand::Block { cell, .. } => {
                        if cell.in_bounds() {
                            self.next_blocks.insert(*cell);
                        }
                    }
                }
            } else if queued.execute_round > self.round {
                remaining_unitr.push(queued);
            }
        }
        self.pending_unitr = remaining_unitr;

        self.round += 1;
    }

    fn find_unit_index(&self, unit_id: u32) -> Option<usize> {
        self.units.iter().position(|unit| unit.id == unit_id)
    }

    fn is_move_valid(&self, unit_index: usize, target: Cell) -> bool {
        if !target.in_bounds() {
            return false;
        }
        if self.active_blocks.contains(&target) {
            return false;
        }
        if self.field.cell_hp(target).unwrap_or(0) <= 0 {
            return false;
        }
        let unit = &self.units[unit_index];
        let unit_sector = Sector::for_cell(unit.cell);
        let target_sector = Sector::for_cell(target);
        unit_sector.is_some() && unit_sector == target_sector
    }

    fn apply_damage_to_units(&mut self, target: Cell, mut damage: i32) -> bool {
        let mut indices: Vec<usize> = self
            .units
            .iter()
            .enumerate()
            .filter(|(_, unit)| unit.cell == target && unit.hp > 0)
            .map(|(index, _)| index)
            .collect();

        if indices.is_empty() {
            return false;
        }

        indices.sort_by_key(|&index| (self.units[index].hp, self.units[index].id));

        for index in indices {
            if damage <= 0 {
                break;
            }
            let unit = &mut self.units[index];
            let applied = damage.min(unit.hp);
            unit.hp -= applied;
            damage -= applied;
        }
        true
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ResolverError {
    TimerTooLong,
}
