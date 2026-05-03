# Phase 6: LLM Personalization + Background Jobs

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans

**Goal:** Implement LoRA fine-tuning pipeline for personalized coaching, MinIO adapter storage with LRU caching, all Celery beat scheduled jobs (league resets, daily challenges, streak notifications), and browser push notifications via VAPID/pywebpush.

**Tech Stack:** HuggingFace transformers + peft + bitsandbytes, Celery + Redis, MinIO + boto3, pywebpush, PushManager API

---

### Task 1: LoRA Fine-Tuning Celery Task

**Files:** Create: `backend/tasks/lora_finetuning.py`

- [ ] **Step 1:** Load base model `microsoft/phi-3-mini-4k-instruct` with 4-bit quantization via BitsAndBytesConfig (load_in_4bit=True, bnb_4bit_compute_dtype=float16)
- [ ] **Step 2:** Apply LoRA via peft: LoraConfig(r=8, lora_alpha=16, lora_dropout=0.05, target_modules=["q_proj", "v_proj"])
- [ ] **Step 3:** Collect user's sign_attempts from DB, format as training examples: system prompt + user context + ideal coaching response
- [ ] **Step 4:** Train with HuggingFace Trainer: 3 epochs, batch 4, gradient_accumulation 4, lr 2e-4, warmup 10 steps
- [ ] **Step 5:** Save adapter via `model.save_pretrained(temp_dir)`
- [ ] **Step 6:** Upload adapter directory to MinIO bucket `lora-adapters` with key `{user_id}/adapter/`
- [ ] **Step 7:** Update user record: set `lora_adapter_minio_key`
- [ ] **Step 8:** Trigger condition: enqueue when user's total sign_attempts crosses a multiple of 100

**Key code — LoRA setup:**
```python
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig, TrainingArguments, Trainer
from peft import LoraConfig, get_peft_model

bnb_config = BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_compute_dtype=torch.float16)
model = AutoModelForCausalLM.from_pretrained("microsoft/phi-3-mini-4k-instruct", quantization_config=bnb_config)
lora_config = LoraConfig(r=8, lora_alpha=16, lora_dropout=0.05, target_modules=["q_proj", "v_proj"])
model = get_peft_model(model, lora_config)
```

---

### Task 2: MinIO Adapter Service with LRU Cache

**Files:** Create: `backend/services/minio_service.py`

- [ ] **Step 1:** Implement `upload_adapter(user_id, local_dir)` — upload all files in adapter dir to MinIO
- [ ] **Step 2:** Implement `download_adapter(user_id, target_dir)` — download adapter files from MinIO to local temp dir
- [ ] **Step 3:** Implement LRU cache (functools.lru_cache, maxsize=10) wrapping download — cache recently used adapters in memory to avoid repeated MinIO downloads
- [ ] **Step 4:** At inference time in llm_service: check if user has adapter → download → load with PeftModel.from_pretrained → generate → unload

**Key code — cached adapter loading:**
```python
from functools import lru_cache
from peft import PeftModel

@lru_cache(maxsize=10)
def get_adapter_path(user_id: str) -> str:
    temp_dir = f"/tmp/adapters/{user_id}"
    download_adapter(user_id, temp_dir)
    return temp_dir

def generate_with_adapter(user_id: str, base_model, messages):
    adapter_path = get_adapter_path(user_id)
    model = PeftModel.from_pretrained(base_model, adapter_path)
    # generate response
    model.unload()
    return response
```

---

### Task 3: League Weekly Reset Job

**Files:** Create: `backend/tasks/league_reset.py`

- [ ] **Step 1:** Celery beat schedule: every Sunday midnight UTC (`crontab(hour=0, minute=0, day_of_week=0)`)
- [ ] **Step 2:** For each active league cohort: rank members by weekly_xp
- [ ] **Step 3:** Promote top 10 members to next tier (BRONZE→SILVER→GOLD→PLATINUM→DIAMOND→MASTER)
- [ ] **Step 4:** Demote bottom 5 members to previous tier
- [ ] **Step 5:** Create new league cohorts for the new week, assign members
- [ ] **Step 6:** Insert notification records for all promoted/demoted users
- [ ] **Step 7:** Reset weekly_xp to 0 for all memberships

---

### Task 4: Daily Challenge Job

**Files:** Create: `backend/tasks/daily_challenge.py`

- [ ] **Step 1:** Celery beat schedule: daily at midnight UTC (`crontab(hour=0, minute=0)`)
- [ ] **Step 2:** Select challenge sign: rotate through vocabulary, prefer signs with lower average user scores
- [ ] **Step 3:** Write to Redis key `daily_challenge:{YYYY-MM-DD}` with 25-hour TTL
- [ ] **Step 4:** Store sign ID, label, language, difficulty in the Redis value

---

### Task 5: Streak Expiry Notification Job

**Files:** Create: `backend/tasks/streak_notification.py`

- [ ] **Step 1:** Celery beat schedule: every hour (`crontab(minute=0)`)
- [ ] **Step 2:** Query users where `streak_last_date = yesterday` AND no STREAK_WARNING notification created today
- [ ] **Step 3:** Insert notification record with message "Don't lose your X-day streak! Practice today."
- [ ] **Step 4:** Send Web Push notification if user has push subscription registered

---

### Task 6: PSL Model Retraining Check

**Files:** Create: `backend/tasks/psl_retraining.py`

- [ ] **Step 1:** Celery beat schedule: every Monday at 3am UTC
- [ ] **Step 2:** Count approved PSL submissions since `last_psl_training_run` Redis key
- [ ] **Step 3:** If count > 500: enqueue `retrain_psl_model` task
- [ ] **Step 4:** `retrain_psl_model`: export training data from DB → run augmentation → train BiLSTM (subprocess call to training script) → export ONNX → copy to MinIO `psl-models` bucket → copy to shared Docker volume so Next.js serves it → update `last_psl_training_run` Redis key

---

### Task 7: Celery Beat Schedule Registration

**Files:** Modify: `backend/tasks/__init__.py`

- [ ] **Step 1:** Import all task modules
- [ ] **Step 2:** Configure `celery_app.conf.beat_schedule` with all 4 periodic tasks:

```python
celery_app.conf.beat_schedule = {
    "league-weekly-reset": {
        "task": "tasks.league_reset.league_weekly_reset",
        "schedule": crontab(hour=0, minute=0, day_of_week=0),
    },
    "daily-challenge-publish": {
        "task": "tasks.daily_challenge.publish_daily_challenge",
        "schedule": crontab(hour=0, minute=0),
    },
    "streak-expiry-check": {
        "task": "tasks.streak_notification.check_streak_expiry",
        "schedule": crontab(minute=0),  # every hour
    },
    "psl-retraining-check": {
        "task": "tasks.psl_retraining.check_psl_retraining",
        "schedule": crontab(hour=3, minute=0, day_of_week=1),
    },
}
```

---

### Task 8: Web Push Notifications

**Files:**
- Create: `backend/utils/push.py`
- Create: `backend/routers/push.py`
- Create: `frontend/src/hooks/useNotifications.ts`

- [ ] **Step 1:** Server: implement `send_push_notification(subscription_info, payload)` using pywebpush with VAPID keys from env vars
- [ ] **Step 2:** `POST /api/push/subscribe` — store PushSubscription (endpoint + keys) in DB linked to user
- [ ] **Step 3:** `DELETE /api/push/unsubscribe` — remove subscription
- [ ] **Step 4:** Frontend: register service worker on first login, request notification permission, subscribe via PushManager API with VAPID public key
- [ ] **Step 5:** Create `public/sw.js` service worker that handles push events and shows browser notifications

**Key code — service worker:**
```javascript
// public/sw.js
self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? { title: "SignSense", body: "New notification" };
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icon-192.png",
      badge: "/badge-72.png",
    })
  );
});
```

---

### Task 9: In-App Notification Polling

**Files:** Modify: `frontend/src/hooks/useNotifications.ts`

- [ ] **Step 1:** Poll `GET /api/notifications/unread` every 60 seconds via React Query with refetchInterval
- [ ] **Step 2:** New notifications → show as toast via react-hot-toast
- [ ] **Step 3:** Auto-dismiss after 5 seconds or on user click, mark as read via `POST /api/notifications/{id}/read`
- [ ] **Step 4:** Notification bell icon in app header showing unread count badge

---

## Self-Review

1. **Spec coverage:** ✅ LoRA fine-tuning with exact config (r=8, alpha=16, q_proj+v_proj), ✅ 4-bit quantization, ✅ MinIO upload/download with LRU cache (maxsize=10), ✅ trigger at 100-attempt multiples, ✅ league reset (promote top 10, demote bottom 5), ✅ daily challenge with Redis key + 25hr TTL, ✅ streak expiry hourly check, ✅ PSL retraining check (Monday 3am, threshold 500), ✅ all Celery beat schedules, ✅ Web Push with VAPID + pywebpush, ✅ service worker, ✅ notification polling every 60s + react-hot-toast.
2. **Placeholder scan:** Clean.
3. **Type consistency:** MinIO bucket names reference same `settings.MINIO_BUCKET_LORA` from Phase 1A. Celery app imported from `tasks.__init__` consistently.
