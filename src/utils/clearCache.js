// Cache management utilities
export const clearCache = {
  // Clear all browser caches
  all: async () => {
    try {
      // Clear localStorage
      localStorage.clear();
      
      // Clear sessionStorage
      sessionStorage.clear();
      
      // Clear IndexedDB (if available)
      if ('indexedDB' in window) {
        const databases = await window.indexedDB.databases();
        databases.forEach(db => {
          window.indexedDB.deleteDatabase(db.name);
        });
      }
      
      // Clear service worker cache (if available)
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (let registration of registrations) {
          await registration.unregister();
        }
      }
      
      // Clear fetch cache
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }
      
      console.log('All caches cleared successfully');
      return true;
    } catch (error) {
      console.error('Error clearing cache:', error);
      return false;
    }
  },

  // Clear specific cache types
  localStorage: () => {
    localStorage.clear();
    console.log('localStorage cleared');
  },

  sessionStorage: () => {
    sessionStorage.clear();
    console.log('sessionStorage cleared');
  },

  // Clear specific items from cache
  item: (key, type = 'localStorage') => {
    if (type === 'localStorage') {
      localStorage.removeItem(key);
    } else if (type === 'sessionStorage') {
      sessionStorage.removeItem(key);
    }
    console.log(`${type} item '${key}' cleared`);
  },

  // Clear user-specific data
  userData: () => {
    const keysToRemove = [
      'user',
      'user_profile',
      'user_preferences',
      'auth_token',
      'refresh_token'
    ];
    
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    });
    
    console.log('User data cleared');
  },

  // Clear app-specific data
  appData: () => {
    const keysToRemove = [
      'posts_cache',
      'users_cache',
      'notifications_cache',
      'search_history',
      'theme'
    ];
    
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    });
    
    console.log('App data cleared');
  }
};

// Performance monitoring utilities
export const performance = {
  // Measure function execution time
  measure: (fn, name = 'Function') => {
    const start = performance.now();
    const result = fn();
    const end = performance.now();
    console.log(`${name} took ${end - start} milliseconds`);
    return result;
  },

  // Debounce function
  debounce: (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  // Throttle function
  throttle: (func, limit) => {
    let inThrottle;
    return function() {
      const args = arguments;
      const context = this;
      if (!inThrottle) {
        func.apply(context, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }
};

// Storage utilities with error handling
export const storage = {
  // Safe localStorage getter
  get: (key, defaultValue = null) => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error(`Error getting item '${key}' from localStorage:`, error);
      return defaultValue;
    }
  },

  // Safe localStorage setter
  set: (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error(`Error setting item '${key}' in localStorage:`, error);
      return false;
    }
  },

  // Safe localStorage remover
  remove: (key) => {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error(`Error removing item '${key}' from localStorage:`, error);
      return false;
    }
  },

  // Check if storage is available
  isAvailable: () => {
    try {
      const test = '__storage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch (error) {
      return false;
    }
  }
};

export default clearCache; 