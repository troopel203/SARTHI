// Seed data for SARTHI demo — a fictional rural referral network
// modeled on the Pune district area, Maharashtra.

export const RESOURCE_TYPES = [
  { key: "icuBed", label: "ICU Bed" },
  { key: "generalBed", label: "General Bed" },
  { key: "ventilator", label: "Ventilator" },
  { key: "oxygen", label: "Oxygen Support" },
  { key: "bloodOPos", label: "Blood O+" },
  { key: "bloodOneg", label: "Blood O-" },
  { key: "neonatal", label: "Neonatal Unit" },
  { key: "dialysis", label: "Dialysis" },
];

export const SPECIALISTS = [
  "General Physician",
  "Orthopedic Surgeon",
  "Cardiologist",
  "Obstetrician",
  "Neurologist",
  "Pediatrician",
  "Trauma Surgeon",
  "Anesthetist",
];

export const CONDITIONS = [
  "Road Traffic Accident / Trauma",
  "Cardiac Emergency",
  "Obstetric Emergency (High-risk delivery)",
  "Neonatal Distress",
  "Snakebite / Poisoning",
  "Stroke / Neurological Emergency",
  "Severe Burns",
  "Respiratory Distress",
  "Landslide / Disaster Injury",
  "General Emergency",
];

export const SEED_HOSPITALS = [
  {
    id: "hosp-1",
    name: "Bharati Sahyadri District Hospital",
    lat: 18.5089, lng: 73.8553,
    address: "Shivajinagar, Pune",
    phone: "020-2555-1010",
    tier: "District Hospital",
    specialists: ["General Physician", "Trauma Surgeon", "Orthopedic Surgeon", "Anesthetist"],
    resources: { icuBed: 4, generalBed: 12, ventilator: 3, oxygen: 20, bloodOPos: 6, bloodOneg: 2, neonatal: 2, dialysis: 2 },
  },
  {
    id: "hosp-2",
    name: "Mulshi Rural Health Centre",
    lat: 18.5286, lng: 73.5289,
    address: "Mulshi Taluka, Pune District",
    phone: "020-2555-2020",
    tier: "Rural Hospital",
    specialists: ["General Physician", "Obstetrician"],
    resources: { icuBed: 0, generalBed: 6, ventilator: 0, oxygen: 8, bloodOPos: 2, bloodOneg: 0, neonatal: 1, dialysis: 0 },
  },
  {
    id: "hosp-3",
    name: "Lonavala Multispeciality Hospital",
    lat: 18.7546, lng: 73.4062,
    address: "Lonavala, Pune District",
    phone: "02114-27-3030",
    tier: "Private Multispeciality",
    specialists: ["Cardiologist", "Orthopedic Surgeon", "General Physician", "Anesthetist"],
    resources: { icuBed: 2, generalBed: 10, ventilator: 2, oxygen: 15, bloodOPos: 4, bloodOneg: 1, neonatal: 0, dialysis: 1 },
  },
  {
    id: "hosp-4",
    name: "Baramati Civil Hospital",
    lat: 18.1514, lng: 74.5815,
    address: "Baramati, Pune District",
    phone: "02112-22-4040",
    tier: "Civil Hospital",
    specialists: ["General Physician", "Pediatrician", "Obstetrician", "Trauma Surgeon"],
    resources: { icuBed: 3, generalBed: 14, ventilator: 2, oxygen: 18, bloodOPos: 5, bloodOneg: 2, neonatal: 3, dialysis: 1 },
  },
  {
    id: "hosp-5",
    name: "Junnar Taluka Hospital",
    lat: 19.2072, lng: 73.8783,
    address: "Junnar, Pune District",
    phone: "02132-22-5050",
    tier: "Taluka Hospital",
    specialists: ["General Physician", "Obstetrician"],
    resources: { icuBed: 1, generalBed: 8, ventilator: 1, oxygen: 10, bloodOPos: 3, bloodOneg: 0, neonatal: 1, dialysis: 0 },
  },
  {
    id: "hosp-6",
    name: "Wagholi Trauma & Neuro Institute",
    lat: 18.5793, lng: 73.9862,
    address: "Wagholi, Pune",
    phone: "020-2555-6060",
    tier: "Specialty Institute",
    specialists: ["Neurologist", "Trauma Surgeon", "Anesthetist", "Cardiologist"],
    resources: { icuBed: 6, generalBed: 9, ventilator: 5, oxygen: 25, bloodOPos: 7, bloodOneg: 3, neonatal: 0, dialysis: 2 },
  },
];

export const SEED_PHCS = [
  { id: "phc-1", name: "Mulshi PHC, Paud", lat: 18.5647, lng: 73.5735, address: "Paud, Mulshi Taluka" },
  { id: "phc-2", name: "Velhe PHC", lat: 18.3708, lng: 73.6392, address: "Velhe Taluka, Pune District" },
  { id: "phc-3", name: "Ambegaon PHC, Manchar", lat: 19.0057, lng: 73.9236, address: "Manchar, Ambegaon Taluka" },
  { id: "phc-4", name: "Indapur PHC", lat: 18.1195, lng: 75.0287, address: "Indapur Taluka, Pune District" },
];

export const SEED_AMBULANCES = [
  { id: "amb-1", code: "MH-12-AB-1101", driver: "Sunil Kadam", phcId: "phc-1" },
  { id: "amb-2", code: "MH-12-AB-1102", driver: "Ravindra Pawar", phcId: "phc-2" },
  { id: "amb-3", code: "MH-14-CD-2203", driver: "Anil Shinde", phcId: "phc-3" },
  { id: "amb-4", code: "MH-12-EF-3304", driver: "Mahesh Jadhav", phcId: "phc-4" },
];

// Demo login directory — role + linked entity. This stands in for
// Supabase Auth + RLS in the production architecture (see README).
export const SEED_USERS = [
  { id: "u-phc-1", role: "phc", name: "Dr. Anjali Deshmukh", entityId: "phc-1", entityLabel: "Mulshi PHC, Paud" },
  { id: "u-phc-2", role: "phc", name: "Dr. Sameer Khot", entityId: "phc-2", entityLabel: "Velhe PHC" },
  { id: "u-phc-3", role: "phc", name: "Dr. Neha Kale", entityId: "phc-3", entityLabel: "Ambegaon PHC, Manchar" },
  { id: "u-phc-4", role: "phc", name: "Dr. Rahul Bhosale", entityId: "phc-4", entityLabel: "Indapur PHC" },
  { id: "u-hosp-1", role: "hospital", name: "Sr. Nurse Kavita More", entityId: "hosp-1", entityLabel: "Bharati Sahyadri District Hospital" },
  { id: "u-hosp-2", role: "hospital", name: "Nurse Priya Salunkhe", entityId: "hosp-2", entityLabel: "Mulshi Rural Health Centre" },
  { id: "u-hosp-3", role: "hospital", name: "Admin Rohit Ghadge", entityId: "hosp-3", entityLabel: "Lonavala Multispeciality Hospital" },
  { id: "u-hosp-4", role: "hospital", name: "Sr. Nurse Vaishali Jagtap", entityId: "hosp-4", entityLabel: "Baramati Civil Hospital" },
  { id: "u-hosp-5", role: "hospital", name: "Duty Officer Ganesh Auti", entityId: "hosp-5", entityLabel: "Junnar Taluka Hospital" },
  { id: "u-hosp-6", role: "hospital", name: "Coordinator Snehal Pathak", entityId: "hosp-6", entityLabel: "Wagholi Trauma & Neuro Institute" },
  { id: "u-amb-1", role: "ambulance", name: "Sunil Kadam", entityId: "amb-1", entityLabel: "MH-12-AB-1101" },
  { id: "u-amb-2", role: "ambulance", name: "Ravindra Pawar", entityId: "amb-2", entityLabel: "MH-12-AB-1102" },
  { id: "u-amb-3", role: "ambulance", name: "Anil Shinde", entityId: "amb-3", entityLabel: "MH-14-CD-2203" },
  { id: "u-amb-4", role: "ambulance", name: "Mahesh Jadhav", entityId: "amb-4", entityLabel: "MH-12-EF-3304" },
  { id: "u-admin-1", role: "admin", name: "District Health Officer Suvarna Patil", entityId: "district-pune", entityLabel: "Pune District Health Society" },
];
