use crate::r#match::MatchRegistry;
use crate::rating::RatingService;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::{oneshot, Mutex};
use uuid::Uuid;

const TICK_INTERVAL: Duration = Duration::from_millis(100);
const SEARCH_TIMEOUT: Duration = Duration::from_secs(180);

#[derive(Debug, Clone)]
pub struct MatchFound {
    pub match_id: Uuid,
    pub opponent_id: Uuid,
}

#[derive(Debug)]
pub enum MatchmakingResult {
    Found(MatchFound),
    Timeout,
}

struct SearchEntry {
    player_id: Uuid,
    rating: i32,
    queued_at: Instant,
    responder: oneshot::Sender<MatchmakingResult>,
}

#[derive(Clone)]
pub struct MatchmakingQueue {
    inner: Arc<Mutex<Vec<SearchEntry>>>,
    match_registry: Arc<MatchRegistry>,
    rating: Arc<RatingService>,
}

impl MatchmakingQueue {
    pub fn new(match_registry: Arc<MatchRegistry>, rating: Arc<RatingService>) -> Self {
        Self {
            inner: Arc::new(Mutex::new(Vec::new())),
            match_registry,
            rating,
        }
    }

    pub fn start(self: Arc<Self>) {
        tokio::spawn(async move {
            loop {
                self.tick().await;
                tokio::time::sleep(TICK_INTERVAL).await;
            }
        });
    }

    pub async fn enqueue(
        &self,
        player_id: Uuid,
        rating: i32,
    ) -> oneshot::Receiver<MatchmakingResult> {
        let (tx, rx) = oneshot::channel();
        let mut inner = self.inner.lock().await;
        inner.push(SearchEntry {
            player_id,
            rating,
            queued_at: Instant::now(),
            responder: tx,
        });
        rx
    }

    async fn tick(&self) {
        let mut timed_out = Vec::new();
        let candidate_pair = {
            let mut inner = self.inner.lock().await;
            let now = Instant::now();
            let mut i = 0;
            while i < inner.len() {
                let elapsed = now.duration_since(inner[i].queued_at);
                if elapsed >= SEARCH_TIMEOUT {
                    timed_out.push(inner.remove(i));
                } else {
                    i += 1;
                }
            }

            let mut found = None;
            'outer: for i in 0..inner.len() {
                for j in (i + 1)..inner.len() {
                    let entry_a = &inner[i];
                    let entry_b = &inner[j];
                    if can_match(entry_a, entry_b, now) {
                        let entry_b = inner.remove(j);
                        let entry_a = inner.remove(i);
                        found = Some((entry_a, entry_b));
                        break 'outer;
                    }
                }
            }
            found
        };

        for entry in timed_out {
            let _ = entry.responder.send(MatchmakingResult::Timeout);
        }

        if let Some((entry_a, entry_b)) = candidate_pair {
            let rematch_blocked = self
                .rating
                .is_rematch_blocked(entry_a.player_id, entry_b.player_id)
                .await
                .unwrap_or(false)
                || self
                    .rating
                    .is_rematch_blocked(entry_b.player_id, entry_a.player_id)
                    .await
                    .unwrap_or(false);

            if rematch_blocked {
                let mut inner = self.inner.lock().await;
                inner.push(entry_a);
                inner.push(entry_b);
                return;
            }

            let match_id = self
                .match_registry
                .create_match(vec![entry_a.player_id, entry_b.player_id])
                .await;

            self.rating
                .set_status(entry_a.player_id, "in_match", Duration::from_secs(3600))
                .await
                .ok();
            self.rating
                .set_status(entry_b.player_id, "in_match", Duration::from_secs(3600))
                .await
                .ok();

            let _ = entry_a.responder.send(MatchmakingResult::Found(MatchFound {
                match_id,
                opponent_id: entry_b.player_id,
            }));
            let _ = entry_b.responder.send(MatchmakingResult::Found(MatchFound {
                match_id,
                opponent_id: entry_a.player_id,
            }));
        }
    }
}

fn can_match(entry_a: &SearchEntry, entry_b: &SearchEntry, now: Instant) -> bool {
    let range_a = rating_range(now.duration_since(entry_a.queued_at));
    let range_b = rating_range(now.duration_since(entry_b.queued_at));
    let diff = (entry_a.rating - entry_b.rating).abs();
    diff <= range_a && diff <= range_b
}

fn rating_range(elapsed: Duration) -> i32 {
    let base = (elapsed.as_millis() / 100) as i32;
    let ladder = if elapsed >= Duration::from_secs(120) {
        10
    } else if elapsed >= Duration::from_secs(60) {
        5
    } else {
        0
    };
    base.max(ladder)
}
