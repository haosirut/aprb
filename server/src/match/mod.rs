use crate::rating::{RatingService, RatingUpdate};
use crate::simulation::resolver::{
    ActionCommand, Cell, MatchState, Sector, UnitA, UnitRCommand, FIELD_COLS, FIELD_ROWS,
};
use axum::extract::ws::{Message, WebSocket};
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{broadcast, mpsc, Mutex, RwLock};
use uuid::Uuid;

const DISCONNECT_TIMEOUT: Duration = Duration::from_secs(30);

#[derive(Clone)]
pub struct MatchRegistry {
    sessions: Arc<RwLock<HashMap<Uuid, Arc<MatchSession>>>>,
    rating: Arc<RatingService>,
}

impl MatchRegistry {
    pub fn new(rating: Arc<RatingService>) -> Self {
        Self {
            sessions: Arc::new(RwLock::new(HashMap::new())),
            rating,
        }
    }

    pub async fn create_match(&self, players: Vec<Uuid>) -> Uuid {
        let match_id = Uuid::new_v4();
        let session = Arc::new(MatchSession::new(match_id, players, self.rating.clone()));
        self.sessions.write().await.insert(match_id, session);
        match_id
    }

    pub async fn get_session(&self, match_id: Uuid) -> Option<Arc<MatchSession>> {
        let sessions = self.sessions.read().await;
        sessions.get(&match_id).cloned()
    }
}

#[derive(Clone)]
pub struct MatchSession {
    match_id: Uuid,
    players: Vec<Uuid>,
    state: Arc<Mutex<MatchState>>,
    connections: Arc<Mutex<HashMap<Uuid, PlayerConnection>>>,
    broadcaster: broadcast::Sender<ServerMessage>,
    command_tx: mpsc::Sender<MatchCommand>,
    rating: Arc<RatingService>,
    finished: Arc<Mutex<bool>>,
}

impl MatchSession {
    pub fn new(match_id: Uuid, players: Vec<Uuid>, rating: Arc<RatingService>) -> Self {
        let (command_tx, command_rx) = mpsc::channel(128);
        let (broadcaster, _) = broadcast::channel(128);
        let state = Arc::new(Mutex::new(initial_state()));
        let connections = Arc::new(Mutex::new(initial_connections(&players)));
        let finished = Arc::new(Mutex::new(false));

        let session = Self {
            match_id,
            players: players.clone(),
            state: state.clone(),
            connections: connections.clone(),
            broadcaster: broadcaster.clone(),
            command_tx: command_tx.clone(),
            rating: rating.clone(),
            finished: finished.clone(),
        };

        session.spawn_loop(command_rx, command_tx);
        session
    }

    pub fn subscribe(&self) -> broadcast::Receiver<ServerMessage> {
        self.broadcaster.subscribe()
    }

    pub async fn handle_socket(self: Arc<Self>, player_id: Uuid, socket: WebSocket) {
        let (mut ws_sender, mut ws_receiver) = socket.split();
        let mut receiver = self.subscribe();
        tokio::spawn(async move {
            while let Ok(message) = receiver.recv().await {
                if let Ok(text) = serde_json::to_string(&message) {
                    if ws_sender.send(Message::Text(text)).await.is_err() {
                        break;
                    }
                }
            }
        });

        self.command_tx
            .send(MatchCommand::Connect { player_id })
            .await
            .ok();

        while let Some(Ok(message)) = ws_receiver.next().await {
            match message {
                Message::Text(text) => match serde_json::from_str::<ClientMessage>(&text) {
                    Ok(client_message) => {
                        self.command_tx
                            .send(MatchCommand::ClientMessage {
                                player_id,
                                message: client_message,
                            })
                            .await
                            .ok();
                    }
                    Err(err) => {
                        let _ = self.broadcaster.send(ServerMessage::Error {
                            message: format!("invalid payload: {err}"),
                        });
                    }
                },
                Message::Close(_) => break,
                _ => {}
            }
        }

        self.command_tx
            .send(MatchCommand::Disconnect { player_id })
            .await
            .ok();
    }

    fn spawn_loop(
        &self,
        mut rx: mpsc::Receiver<MatchCommand>,
        command_tx: mpsc::Sender<MatchCommand>,
    ) {
        let state = self.state.clone();
        let connections = self.connections.clone();
        let broadcaster = self.broadcaster.clone();
        let players = self.players.clone();
        let rating = self.rating.clone();
        let finished = self.finished.clone();

        tokio::spawn(async move {
            while let Some(command) = rx.recv().await {
                match command {
                    MatchCommand::Connect { player_id } => {
                        let mut connections = connections.lock().await;
                        if let Some(entry) = connections.get_mut(&player_id) {
                            entry.connected = true;
                        }
                        let state_snapshot = snapshot_state(&state.lock().await);
                        let _ = broadcaster.send(ServerMessage::State(state_snapshot));
                    }
                    MatchCommand::Disconnect { player_id } => {
                        let mut connections = connections.lock().await;
                        if let Some(entry) = connections.get_mut(&player_id) {
                            entry.connected = false;
                            entry.disconnects += 1;
                            if entry.disconnects > 1 {
                                if let Some((winner, loser)) = resolve_forfeit(&players, player_id)
                                {
                                    finalize_match(
                                        &rating,
                                        &finished,
                                        &broadcaster,
                                        winner,
                                        loser,
                                        "technical_defeat",
                                    )
                                    .await;
                                }
                            } else {
                                let timeout_tx = command_tx.clone();
                                tokio::spawn(async move {
                                    tokio::time::sleep(DISCONNECT_TIMEOUT).await;
                                    timeout_tx
                                        .send(MatchCommand::DisconnectTimeout { player_id })
                                        .await
                                        .ok();
                                });
                            }
                        }
                    }
                    MatchCommand::DisconnectTimeout { player_id } => {
                        let connections = connections.lock().await;
                        if let Some(entry) = connections.get(&player_id) {
                            if !entry.connected {
                                if let Some((winner, loser)) = resolve_forfeit(&players, player_id)
                                {
                                    finalize_match(
                                        &rating,
                                        &finished,
                                        &broadcaster,
                                        winner,
                                        loser,
                                        "technical_defeat",
                                    )
                                    .await;
                                }
                            }
                        }
                    }
                    MatchCommand::ClientMessage { message, player_id } => match message {
                        ClientMessage::Action { command } => {
                            let action = command.to_action_command();
                            let mut state = state.lock().await;
                            if let Err(err) = state.queue_action(action) {
                                let _ = broadcaster.send(ServerMessage::Error {
                                    message: format!("action rejected: {err:?}"),
                                });
                            }
                        }
                        ClientMessage::UnitR { command } => {
                            let unitr = command.to_unitr_command();
                            let mut state = state.lock().await;
                            if let Err(err) = state.queue_unitr(unitr) {
                                let _ = broadcaster.send(ServerMessage::Error {
                                    message: format!("unitr rejected: {err:?}"),
                                });
                            }
                        }
                        ClientMessage::Resolve => {
                            let mut state = state.lock().await;
                            state.resolve_round();
                            let snapshot = snapshot_state(&state);
                            let _ = broadcaster.send(ServerMessage::State(snapshot));
                        }
                        ClientMessage::Ping => {
                            let _ = broadcaster.send(ServerMessage::Pong { player_id });
                        }
                    },
                }
            }
        });
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ClientMessage {
    Action { command: ActionPayload },
    UnitR { command: UnitRPayload },
    Resolve,
    Ping,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum ActionPayload {
    Move {
        unit_id: u32,
        to: CellPayload,
        delay_rounds: u32,
    },
    Attack {
        unit_id: u32,
        target: CellPayload,
        damage: i32,
        delay_rounds: u32,
    },
}

impl ActionPayload {
    fn to_action_command(self) -> ActionCommand {
        match self {
            ActionPayload::Move {
                unit_id,
                to,
                delay_rounds,
            } => ActionCommand::Move {
                unit_id,
                to: to.to_cell(),
                delay_rounds,
            },
            ActionPayload::Attack {
                unit_id,
                target,
                damage,
                delay_rounds,
            } => ActionCommand::Attack {
                unit_id,
                target: target.to_cell(),
                damage,
                delay_rounds,
            },
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum UnitRPayload {
    Recon {
        sector: SectorPayload,
        delay_rounds: u32,
    },
    Block {
        cell: CellPayload,
        delay_rounds: u32,
    },
}

impl UnitRPayload {
    fn to_unitr_command(self) -> UnitRCommand {
        match self {
            UnitRPayload::Recon {
                sector,
                delay_rounds,
            } => UnitRCommand::Recon {
                sector: sector.to_sector(),
                delay_rounds,
            },
            UnitRPayload::Block { cell, delay_rounds } => UnitRCommand::Block {
                cell: cell.to_cell(),
                delay_rounds,
            },
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CellPayload {
    pub row: usize,
    pub col: usize,
}

impl CellPayload {
    fn to_cell(self) -> Cell {
        Cell {
            row: self.row,
            col: self.col,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SectorPayload {
    Left,
    Right,
}

impl SectorPayload {
    fn to_sector(self) -> Sector {
        match self {
            SectorPayload::Left => Sector::Left,
            SectorPayload::Right => Sector::Right,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ServerMessage {
    State(StateSnapshot),
    Error {
        message: String,
    },
    Result {
        winner: Option<Uuid>,
        loser: Option<Uuid>,
        reason: String,
        rating: Option<Vec<RatingUpdate>>,
    },
    Pong {
        player_id: Uuid,
    },
}

#[derive(Debug, Clone, Serialize)]
pub struct StateSnapshot {
    pub round: u32,
    pub field: [[i32; FIELD_COLS]; FIELD_ROWS],
    pub units: Vec<UnitSnapshot>,
    pub active_recon: Vec<String>,
    pub active_blocks: Vec<CellPayload>,
}

#[derive(Debug, Clone, Serialize)]
pub struct UnitSnapshot {
    pub id: u32,
    pub hp: i32,
    pub cell: CellPayload,
}

fn snapshot_state(state: &MatchState) -> StateSnapshot {
    StateSnapshot {
        round: state.round,
        field: state.field.cell_hp,
        units: state
            .units
            .iter()
            .map(|unit| UnitSnapshot {
                id: unit.id,
                hp: unit.hp,
                cell: CellPayload {
                    row: unit.cell.row,
                    col: unit.cell.col,
                },
            })
            .collect(),
        active_recon: state
            .active_recon
            .iter()
            .map(|sector| match sector {
                Sector::Left => "left".to_string(),
                Sector::Right => "right".to_string(),
            })
            .collect(),
        active_blocks: state
            .active_blocks
            .iter()
            .map(|cell| CellPayload {
                row: cell.row,
                col: cell.col,
            })
            .collect(),
    }
}

#[derive(Debug)]
enum MatchCommand {
    Connect {
        player_id: Uuid,
    },
    Disconnect {
        player_id: Uuid,
    },
    DisconnectTimeout {
        player_id: Uuid,
    },
    ClientMessage {
        message: ClientMessage,
        player_id: Uuid,
    },
}

#[derive(Debug, Clone)]
struct PlayerConnection {
    connected: bool,
    disconnects: u32,
}

fn initial_state() -> MatchState {
    let mut state = MatchState::new(5);
    state.units = vec![
        UnitA {
            id: 1,
            hp: 10,
            cell: Cell { row: 1, col: 1 },
        },
        UnitA {
            id: 2,
            hp: 10,
            cell: Cell { row: 3, col: 3 },
        },
        UnitA {
            id: 3,
            hp: 10,
            cell: Cell { row: 1, col: 8 },
        },
        UnitA {
            id: 4,
            hp: 10,
            cell: Cell { row: 3, col: 6 },
        },
    ];
    state
}

fn initial_connections(players: &[Uuid]) -> HashMap<Uuid, PlayerConnection> {
    let mut map = HashMap::new();
    for player in players {
        map.insert(
            *player,
            PlayerConnection {
                connected: false,
                disconnects: 0,
            },
        );
    }
    map
}

fn resolve_forfeit(players: &[Uuid], loser: Uuid) -> Option<(Uuid, Uuid)> {
    let winner = players.iter().find(|id| **id != loser).cloned()?;
    Some((winner, loser))
}

async fn finalize_match(
    rating: &RatingService,
    finished: &Mutex<bool>,
    broadcaster: &broadcast::Sender<ServerMessage>,
    winner: Uuid,
    loser: Uuid,
    reason: &str,
) {
    let mut finished_guard = finished.lock().await;
    if *finished_guard {
        return;
    }
    *finished_guard = true;

    let rating_updates = match rating.apply_match_result(winner, loser).await {
        Ok((winner_update, loser_update)) => Some(vec![winner_update, loser_update]),
        Err(_) => None,
    };

    let _ = broadcaster.send(ServerMessage::Result {
        winner: Some(winner),
        loser: Some(loser),
        reason: reason.to_string(),
        rating: rating_updates,
    });
}
