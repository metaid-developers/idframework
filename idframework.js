/**
 * IDFramework - Core Framework for MetaWeb Applications
 * 
 * A lightweight, decentralized SPA framework following Cairngorm MVC philosophy.
 * Designed for MetaID Protocol-based blockchain internet applications.
 * 
 * Core Philosophy:
 * - Single Source of Truth: All application state in global singleton Model layer
 * - View is "Dumb": Views only display data and dispatch events
 * - Command Pattern: Business logic atomized into independent Commands
 * - Separation of Concerns: View, Model, Command, Delegate strictly separated
 * - Event-Driven: Components communicate through events, not direct calls
 * 
 * Data Flow:
 * View -> Event -> IDController -> Command -> BusinessDelegate (Service) -> Model -> View (Binding)
 * 
 * @namespace IDFramework
 */

class IDFramework {
  /**
   * ============================================
   * MODEL LAYER - Single Source of Truth
   * ============================================
   * 
   * The Model layer provides a global singleton store for all application state.
   * It includes built-in models (wallet, app) and allows dynamic model registration.
   * All models are managed through Alpine.js stores for reactive updates.
   */

  /**
   * Initialize Model Layer with built-in models
   * 
   * Built-in Models:
   * - wallet: User wallet information and connection status
   * - app: Application-level global state
   * 
   * Additional models can be registered dynamically via Alpine.store()
   * 
   * Note: This method will NOT overwrite existing stores. If a store already exists,
   * it will be preserved. This allows stores to be registered in index.html
   * before the framework loads, ensuring they're available when Alpine processes the DOM.
   * 
   * @param {Object} customModels - Optional custom models to register
   * @example
   * IDFramework.initModels({
   *   user: { name: '', email: '' },
   *   settings: { theme: 'light' }
   * });
   */
  static initModels(customModels = {}) {
    if (typeof Alpine === 'undefined') {
      throw new Error('Alpine.js is not loaded. Please include Alpine.js before initializing IDFramework.');
    }

    // Built-in Wallet Model
    // Only register if it doesn't already exist (to preserve any existing state)
    if (!Alpine.store('wallet')) {
      Alpine.store('wallet', {
        isConnected: false,
        address: null,
        metaid: null,
        publicKey: null,
        network: null, // 'mainnet' | 'testnet'
      });
    }

    // Built-in App Model
    // Only register if it doesn't already exist (to preserve any existing state)
    if (!Alpine.store('app')) {
      Alpine.store('app', {
        isLogin: false,
        userAddress: null,
        // Additional app-level state can be added here
      });
    }

    // Register custom models if provided
    // Only register if they don't already exist
    Object.keys(customModels).forEach(modelName => {
      if (!Alpine.store(modelName)) {
        Alpine.store(modelName, customModels[modelName]);
      }
    });
  }

  /**
   * ============================================
   * DELEGATE LAYER - Service Abstraction
   * ============================================
   * 
   * Delegate layer abstracts the complexity of remote service communication.
   * It handles API calls, error handling, and returns raw data to Commands.
   * Commands use DataAdapters to transform raw data into Model format.
   * 
   * The Delegate object contains multiple delegate methods for different purposes:
   * - BusinessDelegate: Generic API communication handler
   * - UserDelegate: User-related API calls (e.g., avatar, profile)
   */

  /**
   * Delegate - Service abstraction object
   * 
   * Contains various delegate methods for different types of service communication.
   */
  static Delegate = {
    /**
     * BusinessDelegate - Generic API communication handler
     * 
     * This method abstracts service communication, allowing Commands to focus on business logic
     * rather than HTTP details. It uses ServiceLocator to resolve service base URLs.
     * 
     * @param {string} serviceKey - Key to look up BaseURL from ServiceLocator (e.g., 'metaid_man')
     * @param {string} endpoint - API endpoint path (e.g., '/pin/path/list')
     * @param {Object} options - Fetch options (method, headers, body, etc.)
     * @returns {Promise<Object>} Raw JSON response from the service
     * 
     * @example
     * const data = await IDFramework.Delegate.BusinessDelegate('metaid_man', '/pin/path/list', {
     *   method: 'GET',
     *   headers: { 'Authorization': 'Bearer token' }
     * });
     */
    async BusinessDelegate(serviceKey, endpoint, options = {}) {
      // Validate ServiceLocator exists
      if (!window.ServiceLocator || !window.ServiceLocator[serviceKey]) {
        throw new Error(`Service '${serviceKey}' not found in ServiceLocator. Please define it in app.js`);
      }

      const baseURL = window.ServiceLocator[serviceKey];
      const url = `${baseURL}${endpoint}`;

      // Default fetch options
      const defaultOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      };

      const fetchOptions = { ...defaultOptions, ...options };

      try {
        const response = await fetch(url, fetchOptions);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data;
      } catch (error) {
        console.error(`BusinessDelegate error for ${serviceKey}${endpoint}:`, error);
        throw error;
      }
    },

    /**
     * UserDelegate - User-related API communication handler
     * 
     * This method handles user-related API calls, such as fetching user avatar,
     * profile information, etc. from remote services.
     * 
     * @param {string} serviceKey - Key to look up BaseURL from ServiceLocator
     * @param {string} endpoint - API endpoint path for user-related operations
     * @param {Object} options - Fetch options (method, headers, body, etc.)
     * @returns {Promise<Object>} Raw JSON response from the service
     * 
     * @example
     * const avatarData = await IDFramework.Delegate.UserDelegate('metaid_man', '/user/avatar', {
     *   method: 'GET',
     *   headers: { 'Authorization': 'Bearer token' }
     * });
     */
    async UserDelegate(serviceKey, endpoint, options = {}) {
      // TODO: Implement user-related API communication
      // This method will be used to fetch user avatar and profile information
      // from remote services.
      
      throw new Error('UserDelegate is not yet implemented');
    },
  };

  /**
   * ============================================
   * CONTROLLER LAYER - Event to Command Mapping
   * ============================================
   * 
   * IDController maps events to Commands with async lazy loading.
   * This allows Commands to be loaded on-demand, reducing initial bundle size.
   * 
   * Built-in Commands:
   * - connectWallet: Connect to Metalet wallet
   * - createPIN: Create and broadcast a PIN to the blockchain (mock implementation)
   */

  /**
   * IDController - Maps Events to Commands
   * 
   * The controller maintains a registry of event-to-command mappings.
   * Commands are lazy-loaded when events are dispatched, enabling code splitting.
   */
  static IDController = {
    /**
     * Command registry: Map of event names to command module paths
     * @type {Map<string, string>}
     */
    commands: new Map(),

    /**
     * Built-in command registry for framework-provided commands
     * @type {Map<string, Function>}
     */
    builtInCommands: new Map(),

    /**
     * Register a command for an event
     * 
     * Commands can be:
     * - File paths (e.g., './commands/FetchBuzzCommand.js') - will be lazy-loaded
     * - Built-in command functions (registered via registerBuiltIn)
     * 
     * @param {string} eventName - Event name (e.g., 'fetchBuzz', 'postBuzz')
     * @param {string|Function} commandPathOrFunction - Path to command module or built-in command function
     * 
     * @example
     * // Register a file-based command
     * IDFramework.IDController.register('fetchBuzz', './commands/FetchBuzzCommand.js');
     * 
     * @example
     * // Register a built-in command
     * IDFramework.IDController.registerBuiltIn('connectWallet', IDFramework.BuiltInCommands.connectWallet);
     */
    register(eventName, commandPathOrFunction) {
      if (typeof commandPathOrFunction === 'function') {
        this.builtInCommands.set(eventName, commandPathOrFunction);
      } else {
        this.commands.set(eventName, commandPathOrFunction);
      }
    },

    /**
     * Register a built-in command function
     * 
     * @param {string} eventName - Event name
     * @param {Function} commandFunction - Command function
     */
    registerBuiltIn(eventName, commandFunction) {
      this.builtInCommands.set(eventName, commandFunction);
    },

    /**
     * Execute a command for an event
     * 
     * This method:
     * 1. Looks up the command for the event
     * 2. Lazy-loads file-based commands or uses built-in commands
     * 3. Instantiates and executes the command
     * 4. Passes BusinessDelegate and relevant stores to the command
     * 
     * @param {string} eventName - Event name to execute
     * @param {Object} payload - Event payload data
     * @param {Object} stores - Object containing relevant Alpine stores (optional, auto-resolved if not provided)
     * @returns {Promise<void>}
     * 
     * @example
     * await IDFramework.IDController.execute('fetchBuzz', { cursor: 0, size: 30 });
     */
    async execute(eventName, payload = {}, stores = null) {
      // Check built-in commands first
      const builtInCommand = this.builtInCommands.get(eventName);
      if (builtInCommand) {
        try {
          // Resolve stores if not provided
          if (!stores) {
            stores = {
              wallet: Alpine.store('wallet'),
              app: Alpine.store('app'),
            };
          }
          
          await builtInCommand({
            payload,
            stores,
            delegate: IDFramework.Delegate.BusinessDelegate,
          });
          return;
        } catch (error) {
          console.error(`Error executing built-in command '${eventName}':`, error);
          throw error;
        }
      }

      // Check file-based commands
      const commandPath = this.commands.get(eventName);
      
      if (!commandPath) {
        console.warn(`No command registered for event: ${eventName}`);
        return;
      }

      try {
        // Lazy load the command module
        const CommandModule = await import(commandPath);
        const CommandClass = CommandModule.default || CommandModule[Object.keys(CommandModule)[0]];
        
        if (!CommandClass) {
          throw new Error(`Command class not found in ${commandPath}`);
        }

        const command = new CommandClass();
        
        // Resolve stores if not provided
        if (!stores) {
          stores = {
            wallet: Alpine.store('wallet'),
            app: Alpine.store('app'),
          };
        }
        
        // Execute command with Delegate and stores
        await command.execute({
          payload,
          stores,
          delegate: IDFramework.Delegate.BusinessDelegate,
        });
      } catch (error) {
        console.error(`Error executing command for event '${eventName}':`, error);
        throw error;
      }
    },
  };

  /**
   * ============================================
   * BUILT-IN COMMANDS
   * ============================================
   * 
   * Framework-provided commands for common MetaID operations.
   * These can be used directly or extended by applications.
   */

  /**
   * Built-in Commands collection
   */
  static BuiltInCommands = {
    /**
     * ConnectWalletCommand - Connect to Metalet wallet
     * 
     * Updates the wallet store with connection status and user information.
     * 
     * @param {Object} params - Command parameters
     * @param {Object} params.stores - Alpine stores (wallet, app)
     * @returns {Promise<void>}
     */
    async connectWallet({ stores }) {
      if (!window.metaidwallet) {
        throw new Error('Metalet wallet is not installed. Please install Metalet extension first.');
      }

      try {
        const result = await window.metaidwallet.connect();
        if (result && result.address) {
          // Update wallet store
          stores.wallet.isConnected = true;
          stores.wallet.address = result.address;
          
          // Try to get additional wallet info
          try {
            stores.wallet.metaid = result.metaid || result.address;
            stores.wallet.publicKey = await window.metaidwallet.getPublicKey();
            stores.wallet.network = await window.metaidwallet.getNetwork();
          } catch (e) {
            console.warn('Failed to get additional wallet info:', e);
          }

          // Update app store
          stores.app.isLogin = true;
          stores.app.userAddress = result.address;
        }
      } catch (error) {
        console.error('Failed to connect wallet:', error);
        throw error;
      }
    },

    /**
     * CreatePINCommand - Create and broadcast a PIN to the blockchain
     * 
     * This is a mock implementation. In production, this would:
     * 1. Construct the PIN transaction
     * 2. Sign the transaction using Metalet
     * 3. Broadcast to the blockchain
     * 
     * @param {Object} params - Command parameters
     * @param {Object} params.payload - PIN data (content, path, etc.)
     * @param {Object} params.stores - Alpine stores
     * @returns {Promise<Object>} Created PIN information
     */
    async createPIN({ payload, stores }) {
      // Mock implementation - in production, this would:
      // 1. Construct PIN transaction
      // 2. Sign with Metalet
      // 3. Broadcast to blockchain
      
      const { content, path = '/protocols/simplebuzz', contentType = 'application/json;utf-8' } = payload;

      if (!content) {
        throw new Error('PIN content is required');
      }

      if (!stores.wallet.isConnected) {
        throw new Error('Wallet must be connected to create PIN');
      }

      // Mock: Generate a fake txid
      const mockTxid = IDFramework.BuiltInCommands.generateMockTxid();

      // Mock: Return PIN information
      return {
        txid: mockTxid,
        path: path,
        content: content,
        contentType: contentType,
        author: stores.wallet.address,
        timestamp: Math.floor(Date.now() / 1000),
      };
    },

    /**
     * Generate a mock transaction ID (for development/testing)
     * @returns {string} Mock 64-character hex string
     */
    generateMockTxid() {
      const chars = '0123456789abcdef';
      let txid = '';
      for (let i = 0; i < 64; i++) {
        txid += chars[Math.floor(Math.random() * chars.length)];
      }
      return txid;
    },
  };

  /**
   * ============================================
   * INITIALIZATION
   * ============================================
   */

  /**
   * Initialize IDFramework
   * 
   * This method initializes the framework with built-in models and registers built-in commands.
   * Should be called after Alpine.js is loaded but before DOM processing.
   * 
   * @param {Object} customModels - Optional custom models to register
   * 
   * @example
   * IDFramework.init({
   *   user: { name: '', email: '' }
   * });
   */
  static init(customModels = {}) {
    // Initialize built-in models
    this.initModels(customModels);

    // Register built-in commands
    this.IDController.registerBuiltIn('connectWallet', this.BuiltInCommands.connectWallet);
    this.IDController.registerBuiltIn('createPIN', this.BuiltInCommands.createPIN);
  }

  /**
   * ============================================
   * ROUTER LAYER - Hash-based Routing
   * ============================================
   * 
   * IDRouter handles hash-based routing for SPA navigation.
   * It listens to hash changes and dispatches ROUTE_CHANGE events
   * that are handled by routing commands (e.g., NavigateCommand).
   */

  /**
   * IDRouter - Hash-based Router
   * 
   * Handles route matching, parameter extraction, and dispatches ROUTE_CHANGE events.
   */
  static IDRouter = {
    /**
     * Route configuration array
     * @type {Array<{path: string, view: string}>}
     */
    routes: [],

    /**
     * Initialize the router with route configuration
     * 
     * @param {Array<{path: string, view: string}>} routes - Route configuration
     * @example
     * IDFramework.IDRouter.init([
     *   { path: '/', view: 'home' },
     *   { path: '/profile/:id', view: 'profile' }
     * ]);
     */
    init(routes = []) {
      this.routes = routes;
      
      // Listen to hash changes
      window.addEventListener('hashchange', () => {
        this.handleRouteChange();
      });
      
      // Handle initial load
      window.addEventListener('load', () => {
        this.handleRouteChange();
      });
      
      // Also handle initial hash if present
      if (window.location.hash) {
        this.handleRouteChange();
      }
    },

    /**
     * Match a path against route patterns and extract parameters
     * 
     * @param {string} path - The path to match (e.g., '/profile/123')
     * @param {string} pattern - The route pattern (e.g., '/profile/:id')
     * @returns {Object|null} - Matched route with params, or null if no match
     */
    matchRoute(path, pattern) {
      // Remove leading/trailing slashes and hash
      const normalizePath = (p) => p.replace(/^#?\/?/, '').replace(/\/$/, '');
      const normalizedPath = normalizePath(path);
      const normalizedPattern = normalizePath(pattern);
      
      // Split into segments
      const pathSegments = normalizedPath.split('/').filter(Boolean);
      const patternSegments = normalizedPattern.split('/').filter(Boolean);
      
      // Must have same number of segments
      if (pathSegments.length !== patternSegments.length) {
        return null;
      }
      
      const params = {};
      for (let i = 0; i < patternSegments.length; i++) {
        const patternSegment = patternSegments[i];
        const pathSegment = pathSegments[i];
        
        // Check if this is a parameter (starts with :)
        if (patternSegment.startsWith(':')) {
          const paramName = patternSegment.slice(1);
          params[paramName] = pathSegment;
        } else if (patternSegment !== pathSegment) {
          // Literal segment doesn't match
          return null;
        }
      }
      
      return { params, pattern };
    },

    /**
     * Find matching route for current hash
     * 
     * @returns {Object|null} - Matched route with view and params, or null
     */
    findRoute() {
      const hash = window.location.hash || '#/';
      const path = hash.replace(/^#/, '') || '/';
      
      // Try to match against each route
      for (const route of this.routes) {
        const match = this.matchRoute(path, route.path);
        if (match) {
          return {
            view: route.view,
            params: match.params,
            path: path,
          };
        }
      }
      
      // No match found
      return null;
    },

    /**
     * Handle route change event
     * Dispatches ROUTE_CHANGE event instead of directly updating the view
     */
    async handleRouteChange() {
      const matchedRoute = this.findRoute();
      
      if (matchedRoute) {
        // Dispatch ROUTE_CHANGE event - let NavigateCommand handle the view update
        await IDFramework.dispatch('ROUTE_CHANGE', {
          view: matchedRoute.view,
          params: matchedRoute.params,
          path: matchedRoute.path,
        });
      } else {
        // No route matched - could dispatch a 404 event or default route
        console.warn('No route matched for:', window.location.hash);
      }
    },

    /**
     * Programmatically navigate to a new route
     * 
     * @param {string} path - Path to navigate to (e.g., '/home' or '/profile/123')
     * @example
     * await IDFramework.router.push('/profile/123');
     */
    async push(path) {
      // Ensure path starts with /
      const normalizedPath = path.startsWith('/') ? path : `/${path}`;
      window.location.hash = normalizedPath;
      // hashchange event will trigger handleRouteChange
    },
  };

  /**
   * ============================================
   * HELPER METHODS
   * ============================================
   */

  /**
   * Load a Web Component dynamically (lazy loading)
   * 
   * This method allows components to be loaded on-demand rather than at startup,
   * reducing initial bundle size and improving performance.
   * 
   * @param {string} componentPath - Relative path to the component module (e.g., './idcomponents/id-buzz-card.js')
   * @returns {Promise<void>} Resolves when the component is loaded and registered
   * 
   * @example
   * // Load a component dynamically
   * await IDFramework.loadComponent('./idcomponents/id-buzz-card.js');
   * 
   * // Now the component can be used in the DOM
   * // <id-buzz-card content="Hello" author="user123"></id-buzz-card>
   */
  static async loadComponent(componentPath) {
    try {
      // Use dynamic import to load the component module
      await import(componentPath);
      // Component is automatically registered via customElements.define() in the module
      console.log(`Component loaded: ${componentPath}`);
    } catch (error) {
      console.error(`Failed to load component from ${componentPath}:`, error);
      throw new Error(`Component loading failed: ${error.message}`);
    }
  }

  /**
   * Dispatch an event (helper for views)
   * 
   * This is a convenience method for views to dispatch events.
   * It automatically resolves the appropriate stores and executes the command.
   * 
   * @param {string} eventName - Event name
   * @param {Object} payload - Event payload
   * @param {string} storeName - Optional specific store name (default: auto-resolve all)
   * 
   * @example
   * // In a component
   * await IDFramework.dispatch('fetchBuzz', { cursor: 0, size: 30 });
   * 
   * @example
   * // In a component with specific store
   * await IDFramework.dispatch('updateUser', { name: 'John' }, 'user');
   */
  static async dispatch(eventName, payload = {}, storeName = null) {
    // Auto-resolve all available stores
    // This ensures commands have access to all stores they might need
    const stores = {
      wallet: Alpine.store('wallet'),
      app: Alpine.store('app'),
    };

    // Add all other registered stores (like 'buzz', 'user', etc.)
    // Alpine doesn't provide a direct way to list all stores,
    // so we try common store names and add any that exist
    const commonStoreNames = ['buzz', 'user', 'settings'];
    commonStoreNames.forEach(name => {
      const store = Alpine.store(name);
      if (store) {
        stores[name] = store;
      }
    });

    // If specific store requested, add it (even if not in common list)
    if (storeName && Alpine.store(storeName)) {
      stores[storeName] = Alpine.store(storeName);
    }

    await this.IDController.execute(eventName, payload, stores);
  }
}

// Make IDFramework globally available
window.IDFramework = IDFramework;

// Expose router for convenience
IDFramework.router = IDFramework.IDRouter;

// Auto-initialize framework when Alpine is ready
// This ensures built-in commands are registered even if init() wasn't called explicitly
if (typeof Alpine !== 'undefined') {
  // Alpine is already loaded, initialize now
  IDFramework.init();
} else {
  // Wait for Alpine to load
  window.addEventListener('alpine:init', () => {
    IDFramework.init();
  });
}
