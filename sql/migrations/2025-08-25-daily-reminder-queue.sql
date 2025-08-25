-- 每日WhatsApp提醒队列表
-- 用于存储需要发送WhatsApp提醒的用户信息

CREATE TABLE IF NOT EXISTS daily_reminder_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  phone_e164 text NOT NULL,
  message text NOT NULL,
  ymd date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);

-- 添加索引优化查询性能
CREATE INDEX IF NOT EXISTS idx_daily_reminder_queue_ymd ON daily_reminder_queue(ymd DESC);
CREATE INDEX IF NOT EXISTS idx_daily_reminder_queue_user_ymd ON daily_reminder_queue(user_id, ymd);

-- 添加注释
COMMENT ON TABLE daily_reminder_queue IS '每日WhatsApp提醒队列 - 存储需要发送提醒的用户信息';
COMMENT ON COLUMN daily_reminder_queue.user_id IS '用户ID，关联users表';
COMMENT ON COLUMN daily_reminder_queue.phone_e164 IS '国际格式电话号码，用于WhatsApp API';
COMMENT ON COLUMN daily_reminder_queue.message IS '完整的提醒消息文本';
COMMENT ON COLUMN daily_reminder_queue.ymd IS '提醒队列生成日期';
COMMENT ON COLUMN daily_reminder_queue.created_at IS '记录创建时间戳';