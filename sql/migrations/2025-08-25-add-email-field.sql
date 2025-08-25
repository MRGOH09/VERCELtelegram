-- 添加email字段到user_profile表
-- 用于存储用户的电子邮箱信息

-- 添加email字段
ALTER TABLE user_profile 
ADD COLUMN IF NOT EXISTS email text;

-- 添加email字段注释
COMMENT ON COLUMN user_profile.email IS '用户电子邮箱地址';

-- 添加邮箱格式检查约束（安全方式）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'user_profile_email_format' 
        AND table_name = 'user_profile'
    ) THEN
        ALTER TABLE user_profile 
        ADD CONSTRAINT user_profile_email_format 
        CHECK (email IS NULL OR email ~* '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$');
    END IF;
END $$;