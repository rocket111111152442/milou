// Isolated test configuration: in-memory database, demo catalogue, test notifications, no API keys.
process.env.PGLITE_DIR = "memory://";
process.env.DATABASE_URL = "";
process.env.ALTERESTATE_PUBLIC_TOKEN = "";
process.env.ANTHROPIC_API_KEY = "test-key-not-used";
process.env.NOTIFY_MODE = "test";
process.env.NOTIFY_EMAIL_TO = "inbox@example.invalid";
process.env.SESSION_SECRET = "x".repeat(40);
process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
