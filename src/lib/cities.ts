export interface City {
  name: string;
  country: string;
  lat: number;
  lon: number;
}

const raw: City[] = [
  // India
  { name: "Bengaluru", country: "India", lat: 12.97, lon: 77.59 },
  { name: "Mumbai", country: "India", lat: 19.08, lon: 72.88 },
  { name: "Delhi", country: "India", lat: 28.61, lon: 77.21 },
  { name: "Hyderabad", country: "India", lat: 17.39, lon: 78.49 },
  { name: "Chennai", country: "India", lat: 13.08, lon: 80.27 },
  { name: "Kolkata", country: "India", lat: 22.57, lon: 88.36 },
  { name: "Pune", country: "India", lat: 18.52, lon: 73.86 },
  { name: "Ahmedabad", country: "India", lat: 23.02, lon: 72.57 },
  { name: "Jaipur", country: "India", lat: 26.91, lon: 75.79 },
  { name: "Surat", country: "India", lat: 21.17, lon: 72.83 },
  { name: "Lucknow", country: "India", lat: 26.85, lon: 80.95 },
  { name: "Kanpur", country: "India", lat: 26.45, lon: 80.33 },
  { name: "Nagpur", country: "India", lat: 21.15, lon: 79.09 },
  { name: "Indore", country: "India", lat: 22.72, lon: 75.86 },
  { name: "Bhopal", country: "India", lat: 23.26, lon: 77.41 },
  { name: "Visakhapatnam", country: "India", lat: 17.69, lon: 83.22 },
  { name: "Patna", country: "India", lat: 25.59, lon: 85.14 },
  { name: "Vadodara", country: "India", lat: 22.31, lon: 73.18 },
  { name: "Ludhiana", country: "India", lat: 30.9, lon: 75.86 },
  { name: "Agra", country: "India", lat: 27.18, lon: 78.01 },
  { name: "Nashik", country: "India", lat: 20.0, lon: 73.79 },
  { name: "Coimbatore", country: "India", lat: 11.02, lon: 76.96 },
  { name: "Kochi", country: "India", lat: 9.93, lon: 76.27 },
  { name: "Thiruvananthapuram", country: "India", lat: 8.52, lon: 76.94 },
  { name: "Kozhikode", country: "India", lat: 11.26, lon: 75.78 },
  { name: "Mysuru", country: "India", lat: 12.3, lon: 76.64 },
  { name: "Mangaluru", country: "India", lat: 12.91, lon: 74.86 },
  { name: "Madurai", country: "India", lat: 9.93, lon: 78.12 },
  { name: "Chandigarh", country: "India", lat: 30.73, lon: 76.78 },
  { name: "Gurugram", country: "India", lat: 28.46, lon: 77.03 },
  { name: "Noida", country: "India", lat: 28.54, lon: 77.39 },
  { name: "Navi Mumbai", country: "India", lat: 19.03, lon: 73.03 },
  { name: "Thane", country: "India", lat: 19.22, lon: 72.98 },
  { name: "Goa", country: "India", lat: 15.49, lon: 73.83 },
  { name: "Bhubaneswar", country: "India", lat: 20.3, lon: 85.82 },
  { name: "Guwahati", country: "India", lat: 26.14, lon: 91.74 },
  { name: "Ranchi", country: "India", lat: 23.34, lon: 85.31 },
  { name: "Raipur", country: "India", lat: 21.25, lon: 81.63 },
  { name: "Dehradun", country: "India", lat: 30.32, lon: 78.03 },
  { name: "Amritsar", country: "India", lat: 31.63, lon: 74.87 },
  { name: "Jodhpur", country: "India", lat: 26.24, lon: 73.02 },
  { name: "Udaipur", country: "India", lat: 24.59, lon: 73.71 },
  { name: "Varanasi", country: "India", lat: 25.32, lon: 82.97 },
  { name: "Vijayawada", country: "India", lat: 16.51, lon: 80.65 },
  { name: "Tiruchirappalli", country: "India", lat: 10.79, lon: 78.7 },
  { name: "Hubballi", country: "India", lat: 15.36, lon: 75.12 },
  { name: "Shimla", country: "India", lat: 31.1, lon: 77.17 },
  { name: "Srinagar", country: "India", lat: 34.08, lon: 74.8 },
  { name: "Puducherry", country: "India", lat: 11.94, lon: 79.81 },
  { name: "Gandhinagar", country: "India", lat: 23.22, lon: 72.65 },
  { name: "Faridabad", country: "India", lat: 28.41, lon: 77.31 },
  { name: "Ghaziabad", country: "India", lat: 28.67, lon: 77.43 },
  { name: "Meerut", country: "India", lat: 28.98, lon: 77.71 },
  { name: "Rajkot", country: "India", lat: 22.3, lon: 70.8 },
  { name: "Durgapur", country: "India", lat: 23.52, lon: 87.31 },
  { name: "Asansol", country: "India", lat: 23.68, lon: 86.99 },
  { name: "Jamshedpur", country: "India", lat: 22.8, lon: 86.2 },
  { name: "Allahabad", country: "India", lat: 25.45, lon: 81.85 },
  { name: "Jabalpur", country: "India", lat: 23.17, lon: 79.95 },
  { name: "Gwalior", country: "India", lat: 26.22, lon: 78.18 },
  { name: "Aurangabad", country: "India", lat: 19.88, lon: 75.32 },
  { name: "Solapur", country: "India", lat: 17.68, lon: 75.92 },
  { name: "Tiruppur", country: "India", lat: 11.11, lon: 77.34 },
  { name: "Salem", country: "India", lat: 11.65, lon: 78.16 },
  { name: "Warangal", country: "India", lat: 17.97, lon: 79.59 },
  { name: "Guntur", country: "India", lat: 16.3, lon: 80.44 },
  { name: "Bhiwandi", country: "India", lat: 19.3, lon: 73.06 },
  { name: "Saharanpur", country: "India", lat: 29.97, lon: 77.55 },
  { name: "Bareilly", country: "India", lat: 28.37, lon: 79.43 },
  { name: "Moradabad", country: "India", lat: 28.83, lon: 78.78 },
  { name: "Aligarh", country: "India", lat: 27.88, lon: 78.08 },
  { name: "Muzaffarpur", country: "India", lat: 26.12, lon: 85.37 },
  { name: "Malda", country: "India", lat: 25.0, lon: 88.14 },
  { name: "Dibrugarh", country: "India", lat: 27.47, lon: 94.91 },
  { name: "Shillong", country: "India", lat: 25.58, lon: 91.89 },
  { name: "Imphal", country: "India", lat: 24.82, lon: 93.94 },
  { name: "Aizawl", country: "India", lat: 23.73, lon: 92.72 },
  { name: "Kohima", country: "India", lat: 25.67, lon: 94.1 },
  { name: "Itanagar", country: "India", lat: 27.08, lon: 93.6 },
  { name: "Gangtok", country: "India", lat: 27.33, lon: 88.61 },
  { name: "Port Blair", country: "India", lat: 11.62, lon: 92.73 },
  { name: "Leh", country: "India", lat: 34.15, lon: 77.58 },

  // South Asia
  { name: "Colombo", country: "Sri Lanka", lat: 6.93, lon: 79.86 },
  { name: "Dhaka", country: "Bangladesh", lat: 23.81, lon: 90.41 },
  { name: "Chittagong", country: "Bangladesh", lat: 22.36, lon: 91.78 },
  { name: "Kathmandu", country: "Nepal", lat: 27.72, lon: 85.32 },
  { name: "Karachi", country: "Pakistan", lat: 24.86, lon: 67.01 },
  { name: "Lahore", country: "Pakistan", lat: 31.55, lon: 74.34 },
  { name: "Islamabad", country: "Pakistan", lat: 33.68, lon: 73.05 },
  { name: "Thimphu", country: "Bhutan", lat: 27.47, lon: 89.64 },
  { name: "Malé", country: "Maldives", lat: 4.18, lon: 73.51 },

  // Middle East
  { name: "Dubai", country: "UAE", lat: 25.2, lon: 55.27 },
  { name: "Abu Dhabi", country: "UAE", lat: 24.45, lon: 54.38 },
  { name: "Sharjah", country: "UAE", lat: 25.35, lon: 55.42 },
  { name: "Doha", country: "Qatar", lat: 25.29, lon: 51.53 },
  { name: "Riyadh", country: "Saudi Arabia", lat: 24.71, lon: 46.68 },
  { name: "Jeddah", country: "Saudi Arabia", lat: 21.49, lon: 39.19 },
  { name: "Kuwait City", country: "Kuwait", lat: 29.38, lon: 47.99 },
  { name: "Muscat", country: "Oman", lat: 23.59, lon: 58.41 },
  { name: "Manama", country: "Bahrain", lat: 26.23, lon: 50.59 },
  { name: "Tel Aviv", country: "Israel", lat: 32.09, lon: 34.78 },
  { name: "Amman", country: "Jordan", lat: 31.95, lon: 35.93 },
  { name: "Beirut", country: "Lebanon", lat: 33.89, lon: 35.5 },
  { name: "Istanbul", country: "Türkiye", lat: 41.01, lon: 28.98 },
  { name: "Ankara", country: "Türkiye", lat: 39.93, lon: 32.86 },
  { name: "Tehran", country: "Iran", lat: 35.69, lon: 51.39 },
  { name: "Cairo", country: "Egypt", lat: 30.04, lon: 31.24 },

  // East & Southeast Asia
  { name: "Singapore", country: "Singapore", lat: 1.35, lon: 103.82 },
  { name: "Kuala Lumpur", country: "Malaysia", lat: 3.14, lon: 101.69 },
  { name: "Jakarta", country: "Indonesia", lat: -6.21, lon: 106.85 },
  { name: "Bali", country: "Indonesia", lat: -8.65, lon: 115.22 },
  { name: "Bangkok", country: "Thailand", lat: 13.76, lon: 100.5 },
  { name: "Ho Chi Minh City", country: "Vietnam", lat: 10.82, lon: 106.63 },
  { name: "Hanoi", country: "Vietnam", lat: 21.03, lon: 105.85 },
  { name: "Manila", country: "Philippines", lat: 14.6, lon: 120.98 },
  { name: "Hong Kong", country: "Hong Kong", lat: 22.32, lon: 114.17 },
  { name: "Shenzhen", country: "China", lat: 22.54, lon: 114.06 },
  { name: "Guangzhou", country: "China", lat: 23.13, lon: 113.26 },
  { name: "Shanghai", country: "China", lat: 31.23, lon: 121.47 },
  { name: "Beijing", country: "China", lat: 39.9, lon: 116.41 },
  { name: "Hangzhou", country: "China", lat: 30.27, lon: 120.16 },
  { name: "Chengdu", country: "China", lat: 30.57, lon: 104.07 },
  { name: "Taipei", country: "Taiwan", lat: 25.03, lon: 121.57 },
  { name: "Seoul", country: "South Korea", lat: 37.57, lon: 126.98 },
  { name: "Busan", country: "South Korea", lat: 35.18, lon: 129.08 },
  { name: "Tokyo", country: "Japan", lat: 35.68, lon: 139.69 },
  { name: "Osaka", country: "Japan", lat: 34.69, lon: 135.5 },
  { name: "Kyoto", country: "Japan", lat: 35.01, lon: 135.77 },
  { name: "Phnom Penh", country: "Cambodia", lat: 11.56, lon: 104.93 },
  { name: "Yangon", country: "Myanmar", lat: 16.87, lon: 96.2 },
  { name: "Ulaanbaatar", country: "Mongolia", lat: 47.89, lon: 106.91 },

  // Oceania
  { name: "Sydney", country: "Australia", lat: -33.87, lon: 151.21 },
  { name: "Melbourne", country: "Australia", lat: -37.81, lon: 144.96 },
  { name: "Brisbane", country: "Australia", lat: -27.47, lon: 153.03 },
  { name: "Perth", country: "Australia", lat: -31.95, lon: 115.86 },
  { name: "Adelaide", country: "Australia", lat: -34.93, lon: 138.6 },
  { name: "Canberra", country: "Australia", lat: -35.28, lon: 149.13 },
  { name: "Auckland", country: "New Zealand", lat: -36.85, lon: 174.76 },
  { name: "Wellington", country: "New Zealand", lat: -41.29, lon: 174.78 },

  // Europe
  { name: "London", country: "UK", lat: 51.51, lon: -0.13 },
  { name: "Manchester", country: "UK", lat: 53.48, lon: -2.24 },
  { name: "Edinburgh", country: "UK", lat: 55.95, lon: -3.19 },
  { name: "Birmingham", country: "UK", lat: 52.49, lon: -1.89 },
  { name: "Cambridge", country: "UK", lat: 52.21, lon: 0.12 },
  { name: "Oxford", country: "UK", lat: 51.75, lon: -1.26 },
  { name: "Dublin", country: "Ireland", lat: 53.35, lon: -6.26 },
  { name: "Paris", country: "France", lat: 48.86, lon: 2.35 },
  { name: "Lyon", country: "France", lat: 45.76, lon: 4.84 },
  { name: "Nice", country: "France", lat: 43.7, lon: 7.27 },
  { name: "Berlin", country: "Germany", lat: 52.52, lon: 13.4 },
  { name: "Munich", country: "Germany", lat: 48.14, lon: 11.58 },
  { name: "Frankfurt", country: "Germany", lat: 50.11, lon: 8.68 },
  { name: "Hamburg", country: "Germany", lat: 53.55, lon: 9.99 },
  { name: "Cologne", country: "Germany", lat: 50.94, lon: 6.96 },
  { name: "Amsterdam", country: "Netherlands", lat: 52.37, lon: 4.9 },
  { name: "Rotterdam", country: "Netherlands", lat: 51.92, lon: 4.48 },
  { name: "Brussels", country: "Belgium", lat: 50.85, lon: 4.35 },
  { name: "Luxembourg", country: "Luxembourg", lat: 49.61, lon: 6.13 },
  { name: "Zurich", country: "Switzerland", lat: 47.38, lon: 8.54 },
  { name: "Geneva", country: "Switzerland", lat: 46.2, lon: 6.14 },
  { name: "Vienna", country: "Austria", lat: 48.21, lon: 16.37 },
  { name: "Prague", country: "Czechia", lat: 50.08, lon: 14.44 },
  { name: "Warsaw", country: "Poland", lat: 52.23, lon: 21.01 },
  { name: "Kraków", country: "Poland", lat: 50.06, lon: 19.94 },
  { name: "Budapest", country: "Hungary", lat: 47.5, lon: 19.04 },
  { name: "Copenhagen", country: "Denmark", lat: 55.68, lon: 12.57 },
  { name: "Stockholm", country: "Sweden", lat: 59.33, lon: 18.07 },
  { name: "Oslo", country: "Norway", lat: 59.91, lon: 10.75 },
  { name: "Helsinki", country: "Finland", lat: 60.17, lon: 24.94 },
  { name: "Tallinn", country: "Estonia", lat: 59.44, lon: 24.75 },
  { name: "Madrid", country: "Spain", lat: 40.42, lon: -3.7 },
  { name: "Barcelona", country: "Spain", lat: 41.39, lon: 2.17 },
  { name: "Lisbon", country: "Portugal", lat: 38.72, lon: -9.14 },
  { name: "Porto", country: "Portugal", lat: 41.15, lon: -8.61 },
  { name: "Rome", country: "Italy", lat: 41.9, lon: 12.5 },
  { name: "Milan", country: "Italy", lat: 45.46, lon: 9.19 },
  { name: "Athens", country: "Greece", lat: 37.98, lon: 23.73 },
  { name: "Bucharest", country: "Romania", lat: 44.43, lon: 26.1 },
  { name: "Sofia", country: "Bulgaria", lat: 42.7, lon: 23.32 },
  { name: "Kyiv", country: "Ukraine", lat: 50.45, lon: 30.52 },
  { name: "Moscow", country: "Russia", lat: 55.76, lon: 37.62 },
  { name: "Belgrade", country: "Serbia", lat: 44.79, lon: 20.45 },

  // Africa
  { name: "Lagos", country: "Nigeria", lat: 6.52, lon: 3.38 },
  { name: "Abuja", country: "Nigeria", lat: 9.08, lon: 7.4 },
  { name: "Nairobi", country: "Kenya", lat: -1.29, lon: 36.82 },
  { name: "Johannesburg", country: "South Africa", lat: -26.2, lon: 28.05 },
  { name: "Cape Town", country: "South Africa", lat: -33.92, lon: 18.42 },
  { name: "Accra", country: "Ghana", lat: 5.6, lon: -0.19 },
  { name: "Addis Ababa", country: "Ethiopia", lat: 8.98, lon: 38.76 },
  { name: "Kigali", country: "Rwanda", lat: -1.95, lon: 30.06 },
  { name: "Casablanca", country: "Morocco", lat: 33.57, lon: -7.59 },
  { name: "Tunis", country: "Tunisia", lat: 36.81, lon: 10.18 },
  { name: "Dar es Salaam", country: "Tanzania", lat: -6.79, lon: 39.21 },
  { name: "Kampala", country: "Uganda", lat: 0.35, lon: 32.58 },
  { name: "Port Louis", country: "Mauritius", lat: -20.16, lon: 57.5 },
  { name: "Dakar", country: "Senegal", lat: 14.72, lon: -17.47 },

  // North America
  { name: "New York", country: "USA", lat: 40.71, lon: -74.01 },
  { name: "San Francisco", country: "USA", lat: 37.77, lon: -122.42 },
  { name: "San Jose", country: "USA", lat: 37.34, lon: -121.89 },
  { name: "Palo Alto", country: "USA", lat: 37.44, lon: -122.14 },
  { name: "Los Angeles", country: "USA", lat: 34.05, lon: -118.24 },
  { name: "San Diego", country: "USA", lat: 32.72, lon: -117.16 },
  { name: "Seattle", country: "USA", lat: 47.61, lon: -122.33 },
  { name: "Portland", country: "USA", lat: 45.52, lon: -122.68 },
  { name: "Austin", country: "USA", lat: 30.27, lon: -97.74 },
  { name: "Dallas", country: "USA", lat: 32.78, lon: -96.8 },
  { name: "Houston", country: "USA", lat: 29.76, lon: -95.37 },
  { name: "Chicago", country: "USA", lat: 41.88, lon: -87.63 },
  { name: "Boston", country: "USA", lat: 42.36, lon: -71.06 },
  { name: "Washington DC", country: "USA", lat: 38.91, lon: -77.04 },
  { name: "Philadelphia", country: "USA", lat: 39.95, lon: -75.17 },
  { name: "Atlanta", country: "USA", lat: 33.75, lon: -84.39 },
  { name: "Miami", country: "USA", lat: 25.76, lon: -80.19 },
  { name: "Denver", country: "USA", lat: 39.74, lon: -104.99 },
  { name: "Phoenix", country: "USA", lat: 33.45, lon: -112.07 },
  { name: "Las Vegas", country: "USA", lat: 36.17, lon: -115.14 },
  { name: "Salt Lake City", country: "USA", lat: 40.76, lon: -111.89 },
  { name: "Minneapolis", country: "USA", lat: 44.98, lon: -93.27 },
  { name: "Detroit", country: "USA", lat: 42.33, lon: -83.05 },
  { name: "Nashville", country: "USA", lat: 36.16, lon: -86.78 },
  { name: "Raleigh", country: "USA", lat: 35.78, lon: -78.64 },
  { name: "Charlotte", country: "USA", lat: 35.23, lon: -80.84 },
  { name: "Pittsburgh", country: "USA", lat: 40.44, lon: -80.0 },
  { name: "Newark", country: "USA", lat: 40.74, lon: -74.17 },
  { name: "Honolulu", country: "USA", lat: 21.31, lon: -157.86 },
  { name: "Toronto", country: "Canada", lat: 43.65, lon: -79.38 },
  { name: "Kitchener–Waterloo", country: "Canada", lat: 43.45, lon: -80.49 },
  { name: "Vancouver", country: "Canada", lat: 49.28, lon: -123.12 },
  { name: "Montreal", country: "Canada", lat: 45.5, lon: -73.57 },
  { name: "Calgary", country: "Canada", lat: 51.05, lon: -114.07 },
  { name: "Ottawa", country: "Canada", lat: 45.42, lon: -75.7 },
  { name: "Mexico City", country: "Mexico", lat: 19.43, lon: -99.13 },
  { name: "Guadalajara", country: "Mexico", lat: 20.66, lon: -103.35 },

  // South America
  { name: "São Paulo", country: "Brazil", lat: -23.55, lon: -46.63 },
  { name: "Rio de Janeiro", country: "Brazil", lat: -22.91, lon: -43.17 },
  { name: "Buenos Aires", country: "Argentina", lat: -34.6, lon: -58.38 },
  { name: "Santiago", country: "Chile", lat: -33.45, lon: -70.67 },
  { name: "Lima", country: "Peru", lat: -12.05, lon: -77.04 },
  { name: "Bogotá", country: "Colombia", lat: 4.71, lon: -74.07 },
  { name: "Medellín", country: "Colombia", lat: 6.24, lon: -75.58 },
  { name: "Montevideo", country: "Uruguay", lat: -34.9, lon: -56.16 },
];

export const citiesByName: Record<string, City> = {};
export const citiesByLabel: Record<string, string> = {};
export const allCityNames: string[] = [];

raw.forEach((city) => {
  citiesByName[city.name] = city;
  const label = `${city.name}, ${city.country}`;
  citiesByLabel[label] = city.name;
  allCityNames.push(city.name);
});

const aliases: Record<string, string> = {
  bangalore: "Bengaluru",
  bombay: "Mumbai",
  calcutta: "Kolkata",
  madras: "Chennai",
  gurgaon: "Gurugram",
  "new delhi": "Delhi",
  mysore: "Mysuru",
  mangalore: "Mangaluru",
  trivandrum: "Thiruvananthapuram",
  calicut: "Kozhikode",
  vizag: "Visakhapatnam",
  cochin: "Kochi",
  pondicherry: "Puducherry",
  hubli: "Hubballi",
  nyc: "New York",
  sf: "San Francisco",
  "bay area": "San Francisco",
  la: "Los Angeles",
  dc: "Washington DC",
  waterloo: "Kitchener–Waterloo",
  kitchener: "Kitchener–Waterloo",
  saigon: "Ho Chi Minh City",
  kiev: "Kyiv",
  allahabad: "Allahabad",
};

export function findCity(text: string): City | null {
  const t = text.trim();
  if (!t) return null;
  const label = citiesByLabel[t];
  if (label) return citiesByName[label];
  const low = t.toLowerCase().split(",")[0].trim();
  if (aliases[low]) return citiesByName[aliases[low]];
  for (const name of allCityNames) {
    if (name.toLowerCase() === low) return citiesByName[name];
  }
  for (const name of allCityNames) {
    if (name.toLowerCase().startsWith(low)) return citiesByName[name];
  }
  return null;
}

export function matchCities(text: string, limit = 8): string[] {
  const low = text.toLowerCase().split(",")[0].trim();
  if (!low) return [];
  const out = new Set<string>();
  if (aliases[low]) out.add(aliases[low]);
  for (const name of allCityNames) {
    if (name.toLowerCase().startsWith(low)) out.add(name);
  }
  for (const name of allCityNames) {
    if (name.toLowerCase().includes(low) && !out.has(name)) out.add(name);
  }
  return Array.from(out).slice(0, limit);
}

export function nearestBigCity(lat: number, lon: number): City | null {
  let best: City | null = null;
  let bestD = Infinity;
  for (const city of raw) {
    const d = haversineKm(lat, lon, city.lat, city.lon);
    if (d < bestD) {
      bestD = d;
      best = city;
    }
  }
  return best;
}

function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number) {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) *
      Math.cos((bLat * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export { raw as cities };
