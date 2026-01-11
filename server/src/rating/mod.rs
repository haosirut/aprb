use redis::AsyncCommands;
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Postgres, Transaction};
use std::time::Duration;
use uuid::Uuid;

const DEFAULT_RATING: i32 = 1000;
const K_FACTOR: f64 = 32.0;
const REMATCH_BLOCK_TTL: Duration = Duration::from_secs(60 * 60);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RatingUpdate {
    pub player_id: Uuid,
    pub old_rating: i32,
    pub new_rating: i32,
    pub delta: i32,
}

#[derive(Clone)]
pub struct RatingService {
    pool: PgPool,
    redis: redis::Client,
}

impl RatingService {
    pub async fn new(pool: PgPool, redis: redis::Client) -> Result<Self, sqlx::Error> {
        let service = Self { pool, redis };
        service.ensure_schema().await?;
        Ok(service)
    }

    async fn ensure_schema(&self) -> Result<(), sqlx::Error> {
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS player_ratings (
                player_id UUID PRIMARY KEY,
                rating INTEGER NOT NULL,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            "#,
        )
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn get_rating(&self, player_id: Uuid) -> Result<i32, sqlx::Error> {
        let existing = sqlx::query!(
            "SELECT rating FROM player_ratings WHERE player_id = $1",
            player_id
        )
        .fetch_optional(&self.pool)
        .await?;

        if let Some(row) = existing {
            Ok(row.rating)
        } else {
            sqlx::query!(
                "INSERT INTO player_ratings (player_id, rating) VALUES ($1, $2)",
                player_id,
                DEFAULT_RATING
            )
            .execute(&self.pool)
            .await?;
            Ok(DEFAULT_RATING)
        }
    }

    pub async fn apply_match_result(
        &self,
        winner: Uuid,
        loser: Uuid,
    ) -> Result<(RatingUpdate, RatingUpdate), sqlx::Error> {
        let mut tx = self.pool.begin().await?;
        let winner_rating = self.get_rating_tx(&mut tx, winner).await?;
        let loser_rating = self.get_rating_tx(&mut tx, loser).await?;

        let (winner_new, loser_new) = calculate_elo(winner_rating, loser_rating, 1.0);

        self.update_rating_tx(&mut tx, winner, winner_new).await?;
        self.update_rating_tx(&mut tx, loser, loser_new).await?;
        tx.commit().await?;

        let winner_update = RatingUpdate {
            player_id: winner,
            old_rating: winner_rating,
            new_rating: winner_new,
            delta: winner_new - winner_rating,
        };
        let loser_update = RatingUpdate {
            player_id: loser,
            old_rating: loser_rating,
            new_rating: loser_new,
            delta: loser_new - loser_rating,
        };

        self.block_rematch(winner, loser).await.ok();
        self.block_rematch(loser, winner).await.ok();
        self.set_status(winner, "idle", Duration::from_secs(3600))
            .await
            .ok();
        self.set_status(loser, "idle", Duration::from_secs(3600))
            .await
            .ok();

        Ok((winner_update, loser_update))
    }

    pub async fn set_status(
        &self,
        player_id: Uuid,
        status: &str,
        ttl: Duration,
    ) -> redis::RedisResult<()> {
        let mut connection = self.redis.get_async_connection().await?;
        let key = format!("player_status:{}", player_id);
        connection.set_ex(key, status, ttl.as_secs() as usize).await
    }

    pub async fn is_rematch_blocked(
        &self,
        player_id: Uuid,
        opponent_id: Uuid,
    ) -> redis::RedisResult<bool> {
        let mut connection = self.redis.get_async_connection().await?;
        let key = format!("rematch_block:{}:{}", player_id, opponent_id);
        let exists: bool = connection.exists(key).await?;
        Ok(exists)
    }

    async fn block_rematch(&self, player_id: Uuid, opponent_id: Uuid) -> redis::RedisResult<()> {
        let mut connection = self.redis.get_async_connection().await?;
        let key = format!("rematch_block:{}:{}", player_id, opponent_id);
        connection
            .set_ex(key, 1, REMATCH_BLOCK_TTL.as_secs() as usize)
            .await
    }

    async fn get_rating_tx(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        player_id: Uuid,
    ) -> Result<i32, sqlx::Error> {
        let existing = sqlx::query!(
            "SELECT rating FROM player_ratings WHERE player_id = $1",
            player_id
        )
        .fetch_optional(&mut **tx)
        .await?;

        if let Some(row) = existing {
            Ok(row.rating)
        } else {
            sqlx::query!(
                "INSERT INTO player_ratings (player_id, rating) VALUES ($1, $2)",
                player_id,
                DEFAULT_RATING
            )
            .execute(&mut **tx)
            .await?;
            Ok(DEFAULT_RATING)
        }
    }

    async fn update_rating_tx(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        player_id: Uuid,
        rating: i32,
    ) -> Result<(), sqlx::Error> {
        sqlx::query!(
            r#"
            INSERT INTO player_ratings (player_id, rating, updated_at)
            VALUES ($1, $2, NOW())
            ON CONFLICT (player_id)
            DO UPDATE SET rating = EXCLUDED.rating, updated_at = EXCLUDED.updated_at
            "#,
            player_id,
            rating
        )
        .execute(&mut **tx)
        .await?;
        Ok(())
    }
}

fn calculate_elo(rating_a: i32, rating_b: i32, score_a: f64) -> (i32, i32) {
    let expected_a = 1.0 / (1.0 + 10f64.powf((rating_b - rating_a) as f64 / 400.0));
    let expected_b = 1.0 - expected_a;
    let score_b = 1.0 - score_a;

    let new_a = (rating_a as f64 + K_FACTOR * (score_a - expected_a)).round() as i32;
    let new_b = (rating_b as f64 + K_FACTOR * (score_b - expected_b)).round() as i32;

    (new_a, new_b)
}
