// SQLite derives the renewal end from the latest committed start inside the
// same write. The final day is clamped to the target month's last day, matching
// SmartLingo's calendar-month behavior for dates such as January 31.
export const COURSE_SUBSCRIPTION_WINDOW_CTES = `subscription_window(start_at) AS (
  SELECT MAX(?,COALESCE((SELECT MAX(COALESCE(trial_ends_at,0),COALESCE(current_period_ends_at,0))
    FROM smartlingo_course_subscriptions WHERE class_id=? AND user_id=?),0))
),
calendar_window(start_at,target_month,source_day,source_time) AS (
  SELECT start_at,
    date(start_at,'unixepoch','start of month','+' || ? || ' months'),
    CAST(strftime('%d',start_at,'unixepoch') AS INTEGER),
    strftime('%H:%M:%S',start_at,'unixepoch')
  FROM subscription_window
),
access_window(start_at,access_ends_at) AS (
  SELECT start_at,CAST(strftime('%s',printf('%s-%02d %s',
    strftime('%Y-%m',target_month),
    MIN(source_day,CAST(strftime('%d',date(target_month,'+1 month','-1 day')) AS INTEGER)),
    source_time)) AS INTEGER)
  FROM calendar_window
)`;
