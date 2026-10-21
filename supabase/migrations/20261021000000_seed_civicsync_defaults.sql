INSERT INTO public.report_categories (name, slug, icon, description) VALUES
  ('Garbage', 'garbage', 'Trash2', 'Waste collection, illegal dumping, overflowing bins'),
  ('Road Damage', 'road-damage', 'Construction', 'Potholes, cracked pavement, road erosion'),
  ('Streetlight', 'streetlight', 'Lightbulb', 'Broken or non-functional street lighting'),
  ('Water Leakage', 'water-leakage', 'Droplets', 'Pipe bursts, water supply issues, leaks'),
  ('Medical', 'medical', 'Stethoscope', 'Public health hazards, sanitation emergencies'),
  ('Flood Relief', 'flood-relief', 'Waves', 'Flooding, waterlogging, drainage overflow'),
  ('Education', 'education', 'GraduationCap', 'School infrastructure, educational access issues'),
  ('Food', 'food', 'UtensilsCrossed', 'Food distribution, food safety, hunger relief'),
  ('Shelter', 'shelter', 'Home', 'Housing issues, homeless support, shelter needs'),
  ('Other', 'other', 'CircleHelp', 'Uncategorized community issues')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.system_settings (key, value, description) VALUES
  ('priority_weights', '{"severity": 40, "urgency": 25, "affected_people": 20, "waiting_time": 15}', 'Configurable weights for priority score calculation'),
  ('ai_integration', '{"active": false, "provider": null}', 'AI categorization and classification integration status'),
  ('map_provider', '{"name": "manual", "api_key_configured": false}', 'Map provider configuration'),
  ('notification_channels', '{"in_app": true, "push": false, "sms": false, "email": false, "whatsapp": false}', 'Active notification delivery channels')
ON CONFLICT (key) DO NOTHING;
