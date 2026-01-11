mod api;
mod domain;
mod r#match;
mod matchmaking;
mod rating;
mod simulation;

use crate::api::AppState;
use crate::matchmaking::MatchmakingQueue;
use crate::r#match::MatchRegistry;
use crate::rating::RatingService;
use axum::Router;
use std::collections::HashMap;
use std::env;
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let database_url = env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://postgres:postgres@localhost:5432/postgres".to_string());
    let redis_url = env::var("REDIS_URL").unwrap_or_else(|_| "redis://127.0.0.1/".to_string());
    let bind_address = env::var("BIND_ADDRESS").unwrap_or_else(|_| "0.0.0.0:3000".to_string());

    let pool = sqlx::PgPool::connect(&database_url).await?;
    let redis = redis::Client::open(redis_url)?;
    let rating_service = Arc::new(RatingService::new(pool, redis).await?);

    let match_registry = Arc::new(MatchRegistry::new(rating_service.clone()));
    let matchmaking = Arc::new(MatchmakingQueue::new(
        match_registry.clone(),
        rating_service.clone(),
    ));
    matchmaking.clone().start();

    let state = AppState {
        profiles: Arc::new(RwLock::new(HashMap::<Uuid, api::Profile>::new())),
        matchmaking,
        matches: match_registry,
        rating: rating_service,
    };

    let app: Router = api::router(state);
    let addr: SocketAddr = bind_address.parse()?;

    axum::serve(tokio::net::TcpListener::bind(addr).await?, app).await?;
    Ok(())
}
