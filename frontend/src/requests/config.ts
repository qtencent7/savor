import axios from 'axios';

// Create axios instance
const instance = axios.create({
  baseURL: 'http://localhost:5000',
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
instance.interceptors.request.use(
  (config) => {
    // Here you can add global request processing, such as adding tokens
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
instance.interceptors.response.use(
  (response) => {
    // Directly return response data
    return response;
  },
  (error) => {
    // Handle error response
    if (error.response) {
      // Server returned an error status code
      console.error('Request error:', error.response.status, error.response.data);
    } else if (error.request) {
      // Request was sent but no response was received
      console.error('Network error:', error.message);
    } else {
      // Request configuration error
      console.error('Request configuration error:', error.message);
    }
    return Promise.reject(error);
  }
);

export default instance;
