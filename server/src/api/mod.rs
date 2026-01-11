use crate::matchmaking::{MatchmakingQueue, MatchmakingResult};
use crate::r#match::MatchRegistry;
use crate::rating::RatingService;
use axum::{
    extract::{Path, State, WebSocketUpgrade},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::RwLock;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Profile {
    pub id: Uuid,
    pub nickname: String,
    pub avatar: String,
}

#[derive(Debug, Deserialize)]
struct RegisterRequest {
    nickname: String,
    avatar: String,
}

#[derive(Debug, Deserialize)]
struct MatchmakingRequest {
    player_id: Uuid,
}

#[derive(Debug, Serialize)]
struct MatchmakingResponse {
    match_id: Uuid,
    opponent_id: Uuid,
}

#[derive(Clone)]
pub struct AppState {
    pub profiles: Arc<RwLock<HashMap<Uuid, Profile>>>,
    pub matchmaking: Arc<MatchmakingQueue>,
    pub matches: Arc<MatchRegistry>,
    pub rating: Arc<RatingService>,
}

pub fn router(state: AppState) -> Router {
    Router::new()
        .route("/api/register", post(register))
        .route("/api/profile/:id", get(profile))
        .route("/api/matchmaking/start", post(start_matchmaking))
        .route("/api/match/:match_id/ws/:player_id", get(match_ws))
        .with_state(state)
}

async fn register(
    State(state): State<AppState>,
    Json(payload): Json<RegisterRequest>,
) -> impl IntoResponse {
    let profile = Profile {
        id: Uuid::new_v4(),
        nickname: payload.nickname,
        avatar: payload.avatar,
    };
    state
        .profiles
        .write()
        .await
        .insert(profile.id, profile.clone());
    (StatusCode::CREATED, Json(profile))
}

async fn profile(State(state): State<AppState>, Path(id): Path<Uuid>) -> impl IntoResponse {
    let profiles = state.profiles.read().await;
    match profiles.get(&id) {
        Some(profile) => (StatusCode::OK, Json(profile.clone())).into_response(),
        None => StatusCode::NOT_FOUND.into_response(),
    }
}

async fn start_matchmaking(
    State(state): State<AppState>,
    Json(payload): Json<MatchmakingRequest>,
) -> impl IntoResponse {
    let rating = match state.rating.get_rating(payload.player_id).await {
        Ok(value) => value,
        Err(_) => return StatusCode::INTERNAL_SERVER_ERROR.into_response(),
    };

    state
        .rating
        .set_status(payload.player_id, "searching", Duration::from_secs(180))
        .await
        .ok();

    let rx = state.matchmaking.enqueue(payload.player_id, rating).await;
    match rx.await {
        Ok(MatchmakingResult::Found(found)) => {
            state
                .rating
                .set_status(payload.player_id, "matched", Duration::from_secs(300))
                .await
                .ok();
            let response = MatchmakingResponse {
                match_id: found.match_id,
                opponent_id: found.opponent_id,
            };
            (StatusCode::OK, Json(response)).into_response()
        }
        Ok(MatchmakingResult::Timeout) => StatusCode::REQUEST_TIMEOUT.into_response(),
        Err(_) => StatusCode::INTERNAL_SERVER_ERROR.into_response(),
    }
}

async fn match_ws(
    State(state): State<AppState>,
    Path((match_id, player_id)): Path<(Uuid, Uuid)>,
    ws: WebSocketUpgrade,
) -> impl IntoResponse {
    let session = match state.matches.get_session(match_id).await {
        Some(session) => session,
        None => return StatusCode::NOT_FOUND.into_response(),
    };

    ws.on_upgrade(move |socket| session.handle_socket(player_id, socket))
}
