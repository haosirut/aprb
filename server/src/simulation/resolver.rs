use std::collections::{HashMap, HashSet};

pub const FIELD_ROWS: usize = 10;
pub const FIELD_COLS: usize = 5;
pub const SECTOR_ROWS: usize = 5;
pub const MAX_UNITR_PER_CELL: usize = 2;
pub const TURBO_START_ROUND: u32 = 8;

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
    Top,
    Bottom,
}

impl Sector {
    pub fn for_cell(cell: Cell) -> Option<Self> {
        if cell.row < SECTOR_ROWS {
            return Some(Sector::Top);
        }
        if cell.row < FIELD_ROWS {
            return Some(Sector::Bottom);
        }
        None
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
    Move { unit_ids: Vec<u32>, to: Cell },
    Attack { unit_ids: Vec<u32>, target: Cell },
}

#[derive(Debug, Clone)]
pub enum UnitRCommand {
    Assign { cell: Cell },
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
    pub scouted_cells: HashSet<Cell>,
    pub active_blocks: HashSet<Cell>,
    pending_actions: Vec<QueuedAction>,
    pending_unitr: Vec<QueuedUnitR>,
    next_blocks: HashSet<Cell>,
}

impl MatchState {
    pub fn new(default_cell_hp: i32) -> Self {
        Self {
            round: 0,
            field: FieldState::new(default_cell_hp),
            units: Vec::new(),
            scouted_cells: HashSet::new(),
            active_blocks: HashSet::new(),
            pending_actions: Vec::new(),
            pending_unitr: Vec::new(),
            next_blocks: HashSet::new(),
        }
    }

    pub fn queue_action(&mut self, command: ActionCommand) -> Result<(), ResolverError> {
        let execute_round = self.round;
        if command.unit_ids().is_empty() {
            return Err(ResolverError::EmptyPacket);
        }
        if self.units_for_command(&command).is_err() {
            return Err(ResolverError::InvalidUnits);
        }
        self.pending_actions.push(QueuedAction {
            execute_round,
            command,
        });
        Ok(())
    }

    pub fn queue_unitr(&mut self, command: UnitRCommand) -> Result<(), ResolverError> {
        let execute_round = self.round;
        let cell = command.cell();
        if !cell.in_bounds() {
            return Err(ResolverError::InvalidCell);
        }
        if self.field.cell_hp(cell).unwrap_or(0) <= 0 {
            return Err(ResolverError::CellDestroyed);
        }
        let existing = self
            .pending_unitr
            .iter()
            .filter(|queued| queued.execute_round == execute_round && queued.command.cell() == cell)
            .count();
        if existing >= MAX_UNITR_PER_CELL {
            return Err(ResolverError::TooManyUnitR);
        }
        self.pending_unitr.push(QueuedUnitR {
            execute_round,
            command,
        });
        Ok(())
    }

    pub fn resolve_round(&mut self) {
        self.active_blocks = std::mem::take(&mut self.next_blocks);

        let mut moves: Vec<(usize, Cell)> = Vec::new();
        let mut damage_map: HashMap<Cell, i32> = HashMap::new();
        let mut used_units: HashSet<u32> = HashSet::new();

        let mut remaining_actions = Vec::new();
        for queued in self.pending_actions.drain(..) {
            if queued.execute_round == self.round {
                match &queued.command {
                    ActionCommand::Move { unit_ids, to } => {
                        if self.accept_packet(unit_ids, &mut used_units) {
                            if let Ok((origin, indices)) =
                                self.unit_indices_for_packet(unit_ids.as_slice())
                            {
                                if self.is_move_valid(origin, *to) {
                                    for index in indices {
                                        moves.push((index, *to));
                                    }
                                }
                            }
                        }
                    }
                    ActionCommand::Attack { unit_ids, target } => {
                        if self.accept_packet(unit_ids, &mut used_units) {
                            if let Ok((origin, _)) =
                                self.unit_indices_for_packet(unit_ids.as_slice())
                            {
                                if self.is_attack_valid(origin, *target) {
                                    let damage = self.damage_for_packet(unit_ids.len());
                                    if damage > 0 {
                                        *damage_map.entry(*target).or_insert(0) += damage;
                                    }
                                }
                            }
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
        let mut unitr_counts: HashMap<Cell, usize> = HashMap::new();
        for queued in self.pending_unitr.drain(..) {
            if queued.execute_round == self.round {
                let cell = queued.command.cell();
                if cell.in_bounds() && self.field.cell_hp(cell).unwrap_or(0) > 0 {
                    let entry = unitr_counts.entry(cell).or_insert(0);
                    *entry += 1;
                }
            } else if queued.execute_round > self.round {
                remaining_unitr.push(queued);
            }
        }
        self.pending_unitr = remaining_unitr;
        for (cell, count) in unitr_counts {
            if count == 0 {
                continue;
            }
            self.scouted_cells.insert(cell);
            if count >= MAX_UNITR_PER_CELL {
                self.next_blocks.insert(cell);
            }
        }

        self.round += 1;
    }

    fn accept_packet(&self, unit_ids: &[u32], used_units: &mut HashSet<u32>) -> bool {
        for unit_id in unit_ids {
            if used_units.contains(unit_id) {
                return false;
            }
        }
        for unit_id in unit_ids {
            used_units.insert(*unit_id);
        }
        true
    }

    fn units_for_command(&self, command: &ActionCommand) -> Result<(), ResolverError> {
        match command {
            ActionCommand::Move { unit_ids, .. } | ActionCommand::Attack { unit_ids, .. } => {
                if unit_ids.is_empty() {
                    return Err(ResolverError::EmptyPacket);
                }
                let _ = self.unit_indices_for_packet(unit_ids)?;
                Ok(())
            }
        }
    }

    fn unit_indices_for_packet(
        &self,
        unit_ids: &[u32],
    ) -> Result<(Cell, Vec<usize>), ResolverError> {
        let mut indices = Vec::new();
        let mut origin: Option<Cell> = None;
        for unit_id in unit_ids {
            let index = self
                .units
                .iter()
                .position(|unit| unit.id == *unit_id && unit.hp > 0)
                .ok_or(ResolverError::UnitNotFound)?;
            let cell = self.units[index].cell;
            if let Some(existing) = origin {
                if existing != cell {
                    return Err(ResolverError::MixedOriginCells);
                }
            } else {
                origin = Some(cell);
            }
            indices.push(index);
        }
        let origin = origin.ok_or(ResolverError::EmptyPacket)?;
        Ok((origin, indices))
    }

    fn is_move_valid(&self, origin: Cell, target: Cell) -> bool {
        if !target.in_bounds() {
            return false;
        }
        if self.active_blocks.contains(&origin) || self.active_blocks.contains(&target) {
            return false;
        }
        if self.field.cell_hp(target).unwrap_or(0) <= 0 {
            return false;
        }
        let unit_sector = Sector::for_cell(origin);
        let target_sector = Sector::for_cell(target);
        if unit_sector.is_none() || unit_sector != target_sector {
            return false;
        }
        let row_delta = origin.row.abs_diff(target.row) as i32;
        let col_delta = origin.col.abs_diff(target.col) as i32;
        row_delta <= 1 && col_delta <= 1 && (row_delta + col_delta > 0)
    }

    fn is_attack_valid(&self, origin: Cell, target: Cell) -> bool {
        if !target.in_bounds() {
            return false;
        }
        let origin_sector = Sector::for_cell(origin);
        let target_sector = Sector::for_cell(target);
        origin_sector.is_some() && target_sector.is_some() && origin_sector != target_sector
    }

    fn damage_for_packet(&self, count: usize) -> i32 {
        if count == 0 {
            return 0;
        }
        let base = (2 * count as i32) - 1;
        if self.round >= TURBO_START_ROUND {
            base * 3
        } else {
            base
        }
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

        indices.sort_by(|a, b| {
            let hp_a = self.units[*a].hp;
            let hp_b = self.units[*b].hp;
            hp_b.cmp(&hp_a)
                .then_with(|| self.units[*a].id.cmp(&self.units[*b].id))
        });

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
    EmptyPacket,
    InvalidUnits,
    InvalidCell,
    CellDestroyed,
    TooManyUnitR,
    UnitNotFound,
    MixedOriginCells,
}

impl ActionCommand {
    fn unit_ids(&self) -> &[u32] {
        match self {
            ActionCommand::Move { unit_ids, .. } | ActionCommand::Attack { unit_ids, .. } => {
                unit_ids
            }
        }
    }
}

impl UnitRCommand {
    fn cell(&self) -> Cell {
        match self {
            UnitRCommand::Assign { cell } => *cell,
        }
    }
}
