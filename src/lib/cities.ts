export interface City {
  name: string;
  country: string;
  lat: number;
  lon: number;
  /** State or province, where we know it (India, USA). Used to rank a user's neighbours first. */
  region?: string;
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

  // Kerala towns (small places people actually come from)
  { name: "Kannur", country: "India", lat: 11.87, lon: 75.37 },
  { name: "Kasaragod", country: "India", lat: 12.5, lon: 74.99 },
  { name: "Cheruvathur", country: "India", lat: 12.2, lon: 75.17 },
  { name: "Kanhangad", country: "India", lat: 12.31, lon: 75.09 },
  { name: "Nileshwar", country: "India", lat: 12.26, lon: 75.13 },
  { name: "Payyannur", country: "India", lat: 12.1, lon: 75.2 },
  { name: "Taliparamba", country: "India", lat: 12.04, lon: 75.36 },
  { name: "Thalassery", country: "India", lat: 11.75, lon: 75.49 },
  { name: "Mattannur", country: "India", lat: 11.93, lon: 75.58 },
  { name: "Vadakara", country: "India", lat: 11.6, lon: 75.59 },
  { name: "Kalpetta", country: "India", lat: 11.61, lon: 76.08 },
  { name: "Sulthan Bathery", country: "India", lat: 11.66, lon: 76.26 },
  { name: "Mananthavady", country: "India", lat: 11.8, lon: 76.0 },
  { name: "Malappuram", country: "India", lat: 11.07, lon: 76.07 },
  { name: "Manjeri", country: "India", lat: 11.12, lon: 76.12 },
  { name: "Perinthalmanna", country: "India", lat: 10.98, lon: 76.23 },
  { name: "Tirur", country: "India", lat: 10.91, lon: 75.92 },
  { name: "Ponnani", country: "India", lat: 10.77, lon: 75.93 },
  { name: "Palakkad", country: "India", lat: 10.78, lon: 76.65 },
  { name: "Ottappalam", country: "India", lat: 10.77, lon: 76.38 },
  { name: "Thrissur", country: "India", lat: 10.53, lon: 76.21 },
  { name: "Guruvayur", country: "India", lat: 10.59, lon: 76.04 },
  { name: "Irinjalakuda", country: "India", lat: 10.34, lon: 76.21 },
  { name: "Chalakudy", country: "India", lat: 10.31, lon: 76.33 },
  { name: "Kodungallur", country: "India", lat: 10.23, lon: 76.2 },
  { name: "Aluva", country: "India", lat: 10.11, lon: 76.35 },
  { name: "Angamaly", country: "India", lat: 10.2, lon: 76.39 },
  { name: "Perumbavoor", country: "India", lat: 10.11, lon: 76.48 },
  { name: "Muvattupuzha", country: "India", lat: 9.99, lon: 76.58 },
  { name: "Thodupuzha", country: "India", lat: 9.9, lon: 76.72 },
  { name: "Munnar", country: "India", lat: 10.09, lon: 77.06 },
  { name: "Kottayam", country: "India", lat: 9.59, lon: 76.52 },
  { name: "Changanassery", country: "India", lat: 9.44, lon: 76.54 },
  { name: "Pala", country: "India", lat: 9.71, lon: 76.68 },
  { name: "Alappuzha", country: "India", lat: 9.49, lon: 76.34 },
  { name: "Cherthala", country: "India", lat: 9.68, lon: 76.34 },
  { name: "Chengannur", country: "India", lat: 9.32, lon: 76.61 },
  { name: "Thiruvalla", country: "India", lat: 9.38, lon: 76.57 },
  { name: "Pathanamthitta", country: "India", lat: 9.26, lon: 76.79 },
  { name: "Adoor", country: "India", lat: 9.15, lon: 76.73 },
  { name: "Kollam", country: "India", lat: 8.89, lon: 76.61 },
  { name: "Karunagappally", country: "India", lat: 9.06, lon: 76.54 },
  { name: "Kayamkulam", country: "India", lat: 9.17, lon: 76.5 },
  { name: "Attingal", country: "India", lat: 8.7, lon: 76.82 },
  { name: "Varkala", country: "India", lat: 8.73, lon: 76.72 },
  { name: "Nedumangad", country: "India", lat: 8.6, lon: 77.0 },
  { name: "Neyyattinkara", country: "India", lat: 8.4, lon: 77.09 },

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

const REGIONS: Record<string, string[]> = {
  Kerala: [
    "Kochi", "Thiruvananthapuram", "Kozhikode", "Kannur", "Kasaragod", "Cheruvathur", "Kanhangad", "Nileshwar", "Payyannur", "Taliparamba",
    "Thalassery", "Mattannur", "Vadakara", "Kalpetta", "Sulthan Bathery", "Mananthavady", "Malappuram", "Manjeri", "Perinthalmanna", "Tirur",
    "Ponnani", "Palakkad", "Ottappalam", "Thrissur", "Guruvayur", "Irinjalakuda", "Chalakudy", "Kodungallur", "Aluva", "Angamaly", "Perumbavoor",
    "Muvattupuzha", "Thodupuzha", "Munnar", "Kottayam", "Changanassery", "Pala", "Alappuzha", "Cherthala", "Chengannur", "Thiruvalla",
    "Pathanamthitta", "Adoor", "Kollam", "Karunagappally", "Kayamkulam", "Attingal", "Varkala", "Nedumangad", "Neyyattinkara",
  ],
  Karnataka: ["Bengaluru", "Mysuru", "Mangaluru", "Hubballi"],
  "Tamil Nadu": ["Chennai", "Coimbatore", "Madurai", "Tiruchirappalli", "Salem", "Tiruppur"],
  Maharashtra: ["Mumbai", "Pune", "Nagpur", "Nashik", "Navi Mumbai", "Thane", "Bhiwandi", "Aurangabad", "Solapur"],
  Delhi: ["Delhi"],
  Telangana: ["Hyderabad", "Warangal"],
  "Andhra Pradesh": ["Visakhapatnam", "Vijayawada", "Guntur"],
  "West Bengal": ["Kolkata", "Durgapur", "Asansol", "Malda"],
  Gujarat: ["Ahmedabad", "Surat", "Vadodara", "Rajkot", "Gandhinagar"],
  Rajasthan: ["Jaipur", "Jodhpur", "Udaipur"],
  "Uttar Pradesh": ["Lucknow", "Kanpur", "Agra", "Varanasi", "Ghaziabad", "Meerut", "Noida", "Allahabad", "Saharanpur", "Bareilly", "Moradabad", "Aligarh"],
  "Madhya Pradesh": ["Indore", "Bhopal", "Jabalpur", "Gwalior"],
  Haryana: ["Gurugram", "Faridabad"],
  Punjab: ["Ludhiana", "Amritsar"],
  Chandigarh: ["Chandigarh"],
  Bihar: ["Patna", "Muzaffarpur"],
  Jharkhand: ["Ranchi", "Jamshedpur"],
  Odisha: ["Bhubaneswar"],
  Chhattisgarh: ["Raipur"],
  Uttarakhand: ["Dehradun"],
  Goa: ["Goa"],
  Assam: ["Guwahati", "Dibrugarh"],
  "Himachal Pradesh": ["Shimla"],
  "Jammu and Kashmir": ["Srinagar"],
  Puducherry: ["Puducherry"],
  California: ["San Francisco", "San Jose", "Palo Alto", "Los Angeles", "San Diego"],
  Washington: ["Seattle"],
  Oregon: ["Portland"],
  Texas: ["Austin", "Dallas", "Houston"],
  "New York": ["New York"],
  "New Jersey": ["Newark"],
  Illinois: ["Chicago"],
  Massachusetts: ["Boston"],
  Georgia: ["Atlanta"],
  Florida: ["Miami"],
  Colorado: ["Denver"],
  Arizona: ["Phoenix"],
  Nevada: ["Las Vegas"],
  Utah: ["Salt Lake City"],
  Minnesota: ["Minneapolis"],
  Michigan: ["Detroit"],
  Tennessee: ["Nashville"],
  "North Carolina": ["Raleigh", "Charlotte"],
  Pennsylvania: ["Philadelphia", "Pittsburgh"],
  Hawaii: ["Honolulu"],
  "District of Columbia": ["Washington DC"],
};

export const citiesByName: Record<string, City> = {};
export const citiesByLabel: Record<string, string> = {};
export const allCityNames: string[] = [];

raw.forEach((city) => {
  citiesByName[city.name] = city;
  const label = `${city.name}, ${city.country}`;
  citiesByLabel[label] = city.name;
  allCityNames.push(city.name);
});
for (const [region, names] of Object.entries(REGIONS)) for (const n of names) if (citiesByName[n]) citiesByName[n].region = region;

export const aliases: Record<string, string> = {
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
  cannanore: "Kannur",
  tellicherry: "Thalassery",
  trichur: "Thrissur",
  quilon: "Kollam",
  alleppey: "Alappuzha",
  palghat: "Palakkad",
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

// Country names and the few codes people actually type, to the dataset's country name.
// Two-letter codes that are also common word starts (in, it, no, is, be) are left out on purpose.
export const countryAliases: Record<string, string> = {
  us: "USA", usa: "USA", america: "USA", "united states": "USA", "united states of america": "USA", "the us": "USA", "the usa": "USA",
  uk: "UK", gb: "UK", gbr: "UK", "united kingdom": "UK", britain: "UK", "great britain": "UK", england: "UK",
  uae: "UAE", ae: "UAE", "united arab emirates": "UAE", emirates: "UAE",
  ca: "Canada", can: "Canada", au: "Australia", aus: "Australia", nz: "New Zealand", sg: "Singapore", jp: "Japan",
  fr: "France", de: "Germany", deu: "Germany", ie: "Ireland", cn: "China", bharat: "India", ind: "India", turkey: "Türkiye", korea: "South Korea",
  holland: "Netherlands", ksa: "Saudi Arabia", pk: "Pakistan", bd: "Bangladesh", lk: "Sri Lanka", np: "Nepal",
};

/** Cities the client learns about at run time (a pick from /api/cities, a saved map's places) join citiesByName here. */
export function registerCities(list: City[]) {
  for (const c of list) if (!citiesByName[c.name]) citiesByName[c.name] = c;
}

/** What the ranking searches over: names in match order, lower-cased and accent-free, with optional alternate spellings. */
export interface CityIndex {
  rows: { name: string; base: string; alts: string[] }[];
  countries: Map<string, string>;
}
export function buildIndex(entries: { city: City; base?: string; alts?: string[] }[]): CityIndex {
  const countries = new Map<string, string>();
  const rows = entries.map(({ city, base, alts }) => {
    countries.set(norm(city.country), city.country);
    return { name: city.name, base: norm(base ?? city.name), alts: (alts ?? []).map(norm) };
  });
  return { rows, countries };
}
const curatedIndex = buildIndex(raw.map((city) => ({ city })));

export function norm(t: string): string {
  return t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

/** The part before the first comma, normalised. "Kochi, Kerala" is looked up as "kochi". */
const head = (t: string) => norm(t.split(",")[0]);

/** The dataset country a query names exactly ("US", "United Kingdom", "India"), or null. */
export function countryOf(text: string, ix: CityIndex = curatedIndex): string | null {
  const q = norm(text);
  if (!q) return null;
  const c = countryAliases[q] ?? ix.countries.get(q) ?? null;
  return c && ix.countries.has(norm(c)) ? c : null;
}

// One slip (insert, delete, substitute or swap two neighbours) between the query and the same-length
// start of a name. Only for queries of 5+ letters: a short one has too many near neighbours.
export const FUZZY_MIN = 5;
function sameFrom(a: string, i: number, b: string, j: number, bl: number): boolean {
  if (a.length - i !== bl - j) return false;
  for (; i < a.length; i++, j++) if (a.charCodeAt(i) !== b.charCodeAt(j)) return false;
  return true;
}
/** a is within one edit of the first `bl` letters of b. */
function oneEdit(a: string, b: string, bl: number): boolean {
  const d = a.length - bl;
  if (d > 1 || d < -1) return false;
  let i = 0;
  while (i < a.length && i < bl && a.charCodeAt(i) === b.charCodeAt(i)) i++;
  if (i === a.length && i === bl) return true;
  if (d === 0) return sameFrom(a, i + 1, b, i + 1, bl) || (a[i] === b[i + 1] && a[i + 1] === b[i] && sameFrom(a, i + 2, b, i + 2, bl));
  return d === 1 ? sameFrom(a, i + 1, b, i, bl) : sameFrom(a, i, b, i + 1, bl);
}
function nearPrefix(q: string, name: string): boolean {
  if (q.length < FUZZY_MIN) return false;
  for (let len = q.length - 1; len <= q.length + 1; len++) if (len <= name.length && oneEdit(q, name, len)) return true;
  return false;
}

type Tier = "exact" | "prefix" | "loose";

/**
 * Ranked city names for what the user typed.
 * A country name or code gives that country's cities (never substring hits).
 * Otherwise: exact or alias, then names that start with it, then a word that
 * starts with it, then (4+ letters only) names that contain it, and only if
 * none of those exist, near misses. Ties go to the home state, then the home
 * country, then dataset order.
 */
export function rank(text: string, home?: string, ix: CityIndex = curatedIndex): { names: string[]; tier: Tier | "country" } {
  const q = head(text);
  if (!q) return { names: [], tier: "loose" };
  const h = home ? citiesByName[home] : undefined;
  const boost = (name: string) => {
    const c = citiesByName[name];
    return h && c.country === h.country ? (h.region && c.region === h.region ? 0 : 1) : 2;
  };
  const stable = (names: string[]) => !h || names.length < 2 ? names : names.map((n, i) => [n, i] as const).sort((a, b) => boost(a[0]) - boost(b[0]) || a[1] - b[1]).map((x) => x[0]);
  const country = countryOf(text, ix);
  const out = new Set<string>();
  const alias = aliases[q];
  if (alias) out.add(alias);
  if (country) {
    stable(ix.rows.filter((r) => citiesByName[r.name].country === country).map((r) => r.name)).forEach((n) => out.add(n));
    return { names: [...out], tier: "country" };
  }
  // One pass over the rows; each lands in the best step it reaches. Primary names come before alternate
  // spellings (Calicut for Kozhikode) in every step; within a step the home state / country first, then
  // dataset order (curated, then the full list largest first).
  const steps: string[][] = Array.from({ length: 10 }, () => []);
  const [sp, hy] = [" " + q, "-" + q];
  const word = (l: string) => l.includes(sp) || l.includes(hy);
  const sub = q.length >= 4;
  const near = q.length >= FUZZY_MIN;
  for (const { name, base, alts } of ix.rows) {
    if (out.has(name)) continue;
    const a = alts.length > 0;
    const step =
      base === q ? 0
      : a && alts.includes(q) ? 1
      : base.startsWith(q) ? 2
      : a && alts.some((l) => l.startsWith(q)) ? 3
      : word(base) ? 4
      : a && alts.some(word) ? 5
      : sub && base.includes(q) ? 6
      : sub && a && alts.some((l) => l.includes(q)) ? 7
      : near && nearPrefix(q, base) ? 8
      : near && a && alts.some((l) => nearPrefix(q, l)) ? 9
      : -1;
    if (step >= 0) steps[step].push(name);
  }
  const exact = out.size > 0 || steps[0].length + steps[1].length > 0;
  const prefixEnd = out.size + steps[0].length + steps[1].length + steps[2].length + steps[3].length;
  // A near miss only when nothing matched the name exactly (Kannur must not bring Kanpur), and after every plain hit.
  steps.forEach((names, i) => (i < 8 || !exact) && stable(names).forEach((n) => out.add(n)));
  return { names: [...out], tier: exact || prefixEnd > 0 ? (exact ? "exact" : "prefix") : "loose" };
}

export function findCity(text: string, ix: CityIndex = curatedIndex, labels: Record<string, string> = citiesByLabel): City | null {
  const t = text.trim();
  if (!t) return null;
  const label = labels[t];
  if (label) return citiesByName[label];
  const r = rank(t, undefined, ix);
  // A half-typed name of 3 letters or fewer is never guessed for the user.
  if (r.tier === "exact" || (r.tier === "prefix" && head(t).length >= 4)) return citiesByName[r.names[0]] ?? null;
  return null;
}

export function matchCities(text: string, limit = 8, home?: string, ix: CityIndex = curatedIndex): string[] {
  return rank(text, home, ix).names.slice(0, limit);
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
