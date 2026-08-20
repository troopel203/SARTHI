-- Auto-generated from src/data/seed.js — demo Pune-district network

insert into phcs (id, name, lat, lng, address) values
  ('phc-1', 'Mulshi PHC, Paud', 18.5647, 73.5735, 'Paud, Mulshi Taluka'),
  ('phc-2', 'Velhe PHC', 18.3708, 73.6392, 'Velhe Taluka, Pune District'),
  ('phc-3', 'Ambegaon PHC, Manchar', 19.0057, 73.9236, 'Manchar, Ambegaon Taluka'),
  ('phc-4', 'Indapur PHC', 18.1195, 75.0287, 'Indapur Taluka, Pune District')
on conflict (id) do update set name=excluded.name, lat=excluded.lat, lng=excluded.lng, address=excluded.address;

insert into hospitals (id, name, lat, lng, address, phone, tier, specialists, resources) values
  ('hosp-1', 'Bharati Sahyadri District Hospital', 18.5089, 73.8553, 'Shivajinagar, Pune', '020-2555-1010', 'District Hospital', ARRAY['General Physician','Trauma Surgeon','Orthopedic Surgeon','Anesthetist']::text[], '{"icuBed":4,"generalBed":12,"ventilator":3,"oxygen":20,"bloodOPos":6,"bloodOneg":2,"neonatal":2,"dialysis":2}'::jsonb),
  ('hosp-2', 'Mulshi Rural Health Centre', 18.5286, 73.5289, 'Mulshi Taluka, Pune District', '020-2555-2020', 'Rural Hospital', ARRAY['General Physician','Obstetrician']::text[], '{"icuBed":0,"generalBed":6,"ventilator":0,"oxygen":8,"bloodOPos":2,"bloodOneg":0,"neonatal":1,"dialysis":0}'::jsonb),
  ('hosp-3', 'Lonavala Multispeciality Hospital', 18.7546, 73.4062, 'Lonavala, Pune District', '02114-27-3030', 'Private Multispeciality', ARRAY['Cardiologist','Orthopedic Surgeon','General Physician','Anesthetist']::text[], '{"icuBed":2,"generalBed":10,"ventilator":2,"oxygen":15,"bloodOPos":4,"bloodOneg":1,"neonatal":0,"dialysis":1}'::jsonb),
  ('hosp-4', 'Baramati Civil Hospital', 18.1514, 74.5815, 'Baramati, Pune District', '02112-22-4040', 'Civil Hospital', ARRAY['General Physician','Pediatrician','Obstetrician','Trauma Surgeon']::text[], '{"icuBed":3,"generalBed":14,"ventilator":2,"oxygen":18,"bloodOPos":5,"bloodOneg":2,"neonatal":3,"dialysis":1}'::jsonb),
  ('hosp-5', 'Junnar Taluka Hospital', 19.2072, 73.8783, 'Junnar, Pune District', '02132-22-5050', 'Taluka Hospital', ARRAY['General Physician','Obstetrician']::text[], '{"icuBed":1,"generalBed":8,"ventilator":1,"oxygen":10,"bloodOPos":3,"bloodOneg":0,"neonatal":1,"dialysis":0}'::jsonb),
  ('hosp-6', 'Wagholi Trauma & Neuro Institute', 18.5793, 73.9862, 'Wagholi, Pune', '020-2555-6060', 'Specialty Institute', ARRAY['Neurologist','Trauma Surgeon','Anesthetist','Cardiologist']::text[], '{"icuBed":6,"generalBed":9,"ventilator":5,"oxygen":25,"bloodOPos":7,"bloodOneg":3,"neonatal":0,"dialysis":2}'::jsonb)
on conflict (id) do update set name=excluded.name, resources=excluded.resources;

insert into ambulances (id, code, driver, phc_id, status) values
  ('amb-1', 'MH-12-AB-1101', 'Sunil Kadam', 'phc-1', 'available'),
  ('amb-2', 'MH-12-AB-1102', 'Ravindra Pawar', 'phc-2', 'available'),
  ('amb-3', 'MH-14-CD-2203', 'Anil Shinde', 'phc-3', 'available'),
  ('amb-4', 'MH-12-EF-3304', 'Mahesh Jadhav', 'phc-4', 'available')
on conflict (id) do update set code=excluded.code, driver=excluded.driver;
