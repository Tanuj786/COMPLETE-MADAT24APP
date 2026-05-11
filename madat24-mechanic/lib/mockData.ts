import type { CustomerJob, ServiceRequest, ShopProfile, MechanicMetrics, AppNotification, Review, MediaItem, Location } from "~/types";

const uid = (p: string) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
const ago = (d: number) => { const dt = new Date(); dt.setDate(dt.getDate()-d); return dt.toISOString(); };
const hagoMs = (h: number) => { const dt = new Date(); dt.setTime(dt.getTime()-h*3600000); return dt.toISOString(); };

export const LOCS: Location[] = [
  { address:"123 MG Road", city:"Bangalore", state:"Karnataka", pincode:"560001", coordinates:{lat:12.9716,lng:77.5946} },
  { address:"45 Park Street", city:"Mumbai", state:"Maharashtra", pincode:"400001", coordinates:{lat:19.076,lng:72.8777} },
  { address:"67 Connaught Place", city:"Delhi", state:"Delhi", pincode:"110001", coordinates:{lat:28.6139,lng:77.209} },
];

const mockMedia = (n: number, by: string): MediaItem[] =>
  Array.from({length:n}, (_,i) => ({id:uid("m"), type:"photo" as const, uri:`https://images.unsplash.com/photo-148726271561${i}-67b85e0b08d3?w=400`, uploadedAt:hagoMs(2), uploadedBy:by}));

export const customerJobs = (cid: string): CustomerJob[] => [
  { id:uid("j"), customerId:cid, mechanicId:"mech-1", serviceType:"tyre-puncture", vehicleInfo:{type:"car",make:"Maruti",model:"Swift",year:"2020",licensePlate:"KA-01-AB-1234"}, location:LOCS[0], description:"Front left tyre punctured.", status:"in-progress", customerMedia:mockMedia(2,cid), progressMedia:mockMedia(1,"mech-1"), timestamps:{requested:hagoMs(2),accepted:hagoMs(1.5),started:hagoMs(1)}, mechanic:{id:"mech-1",name:"Amit Kumar",shopName:"Amit's Auto Repair",phone:"+91 9876543211",rating:4.8}, estimatedArrival:"10 mins" },
  { id:uid("j"), customerId:cid, mechanicId:"mech-2", serviceType:"battery-jump-start", vehicleInfo:{type:"car",make:"Honda",model:"City",year:"2019"}, location:LOCS[1], description:"Car battery dead.", status:"completed", customerMedia:mockMedia(1,cid), completionMedia:mockMedia(2,"mech-2"), timestamps:{requested:ago(3),accepted:ago(3),started:ago(3),completed:ago(3)}, mechanic:{id:"mech-2",name:"Vijay Singh",shopName:"Quick Fix Auto",phone:"+91 9876543212",rating:4.7}, rating:5, review:"Excellent service!", invoice:{id:uid("i"),jobId:"",invoiceNumber:"INV-00001",date:ago(3),shopInfo:{name:"Quick Fix Auto",address:"Park St, Mumbai",phone:"+91 9876543212"},customerInfo:{name:"Rahul Sharma",phone:"+91 9876543210"},lineItems:[{id:"1",description:"Battery Jump Start",quantity:1,unitPrice:500,total:500}],subtotal:500,tax:90,total:590,paymentStatus:"paid",paymentMethod:"UPI"} },
  { id:uid("j"), customerId:cid, serviceType:"fuel-delivery", vehicleInfo:{type:"bike",make:"Royal Enfield",model:"Classic 350"}, location:LOCS[2], description:"Ran out of fuel.", status:"cancelled", customerMedia:[], timestamps:{requested:ago(7),cancelled:ago(7)} },
];

export const nearbyMechanics = () => [
  { id:"nm-1", name:"Amit Kumar", shopName:"Amit's Auto Repair", distance:1.2, rating:4.8, reviewCount:156, hourlyRate:500, isOnline:true, responseTime:"2 min", services:["tyre-puncture","battery-jump-start","engine-repair"] },
  { id:"nm-2", name:"Rajesh Singh", shopName:"Quick Fix Garage", distance:2.5, rating:4.6, reviewCount:89, hourlyRate:450, isOnline:true, responseTime:"5 min", services:["tyre-puncture","fuel-delivery","oil-change"] },
  { id:"nm-3", name:"Vijay Patel", shopName:"Vijay Motors", distance:3.8, rating:4.9, reviewCount:234, hourlyRate:600, isOnline:true, responseTime:"3 min", services:["engine-repair","brake-repair","ac-repair"] },
  { id:"nm-4", name:"Suresh Sharma", shopName:"City Auto Services", distance:4.5, rating:4.5, reviewCount:67, hourlyRate:400, isOnline:false, responseTime:"8 min", services:["towing-services","oil-change","brake-repair"] },
];

export const shopProfile = (mid: string): ShopProfile => ({ id:"shop-1", mechanicId:mid, shopName:"Amit's Auto Repair", description:"Professional 24/7 roadside assistance. 10+ years experience.", location:LOCS[0], services:["tyre-puncture","fuel-delivery","engine-repair","brake-repair","battery-jump-start","towing-services","oil-change","ac-repair"], gstNumber:"29ABCDE1234F1Z5", whatsappNumber:"+91 9876543211", hourlyRate:500, yearsOfExperience:10, rating:4.8, reviewCount:156, responseRate:95, completionRate:98, isOnline:false });

export const serviceRequests = (): ServiceRequest[] => [
  { id:uid("r"), customerId:"cust-1", customerName:"Priya Patel", customerPhone:"+91 9876543220", serviceType:"engine-repair", vehicleInfo:{type:"car",make:"Hyundai",model:"i20",year:"2021"}, location:LOCS[0], distance:2.5, description:"Engine making strange noise.", media:mockMedia(2,"cust-1"), createdAt:hagoMs(0.5), estimatedPrice:{min:1200,max:2500} },
  { id:uid("r"), customerId:"cust-2", customerName:"Arjun Reddy", customerPhone:"+91 9876543221", serviceType:"tyre-puncture", vehicleInfo:{type:"bike",make:"Bajaj",model:"Pulsar"}, location:LOCS[1], distance:1.8, description:"Flat front tyre.", media:mockMedia(1,"cust-2"), createdAt:hagoMs(1), estimatedPrice:{min:250,max:400} },
];

export const mechanicMetrics = (): MechanicMetrics => ({ totalEarnings:125000, jobsCompleted:150, averageRating:4.8, reviewCount:156, responseRate:95, completionRate:98, customerSatisfaction:96, earningsThisMonth:18500, earningsThisWeek:5200, jobsThisMonth:22, jobsThisWeek:6 });

export const reviews = (mid: string): Review[] => [
  { id:uid("rv"), jobId:uid("j"), customerId:"c1", mechanicId:mid, customerName:"Priya M.", rating:5, review:"Arrived in 10 mins, fixed tyre perfectly. Very professional!", tags:["Quick Response","Professional","Fair Price"], createdAt:ago(2) },
  { id:uid("rv"), jobId:uid("j"), customerId:"c2", mechanicId:mid, customerName:"Arjun K.", rating:4, review:"Good service, knew exactly what to do with the engine.", tags:["Professional","Knowledgeable"], mechanicResponse:"Thank you! Glad I could help.", mechanicResponseAt:ago(1), createdAt:ago(5) },
  { id:uid("rv"), jobId:uid("j"), customerId:"c3", mechanicId:mid, customerName:"Meena S.", rating:5, review:"Best roadside mechanic! Very transparent about costs.", tags:["Transparent","Fast","Friendly"], createdAt:ago(10) },
];

export const notifications = (uid2: string, type: "customer"|"mechanic"): AppNotification[] => {
  if (type==="customer") return [
    { id:uid("n"), userId:uid2, type:"job_accepted", title:"Request Accepted! ✅", message:"Amit Kumar accepted your request. ETA: 10 mins", read:false, createdAt:hagoMs(1.5) },
    { id:uid("n"), userId:uid2, type:"job_started", title:"Mechanic On The Way 🔧", message:"Amit Kumar has started heading to your location", read:false, createdAt:hagoMs(1) },
    { id:uid("n"), userId:uid2, type:"payment_requested", title:"Invoice Ready 📄", message:"Service completed. Invoice INV-00001: ₹590", read:true, createdAt:ago(3) },
  ];
  if (type==="mechanic") return [
    { id:uid("n"), userId:uid2, type:"job_request", title:"New Request! 🔔", message:"Engine repair from Priya Patel — 2.5 km • ₹1200-₹2500", read:false, createdAt:hagoMs(0.5) },
    { id:uid("n"), userId:uid2, type:"payment_received", title:"Payment Received 💰", message:"₹590 via UPI for INV-00001", read:false, createdAt:ago(3) },
    { id:uid("n"), userId:uid2, type:"rating_received", title:"5-Star Review ⭐", message:"Rahul Sharma: 'Excellent service!'", read:true, createdAt:ago(3) },
  ];
  return [];
};
