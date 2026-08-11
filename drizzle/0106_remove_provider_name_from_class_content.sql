UPDATE live_class_rooms
SET title = replace(replace(replace(replace(title, 'RealtimeKit', 'Live Media'), 'RealTimeKit', 'Live Media'), 'REALTIMEKIT', 'LIVE MEDIA'), 'realtimekit', 'live media'),
    description = replace(replace(replace(replace(description, 'RealtimeKit', 'Live Media'), 'RealTimeKit', 'Live Media'), 'REALTIMEKIT', 'LIVE MEDIA'), 'realtimekit', 'live media'),
    subject = replace(replace(replace(replace(subject, 'RealtimeKit', 'Live Media'), 'RealTimeKit', 'Live Media'), 'REALTIMEKIT', 'LIVE MEDIA'), 'realtimekit', 'live media')
WHERE lower(title) LIKE '%realtimekit%'
   OR lower(description) LIKE '%realtimekit%'
   OR lower(subject) LIKE '%realtimekit%';
