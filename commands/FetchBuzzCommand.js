/**
 * FetchBuzzCommand - Business Logic for fetching Buzz feed
 * 
 * Command Pattern implementation following IDFramework architecture.
 * 
 * This command:
 * 1. Uses BusinessDelegate to fetch data from MetaID indexer API
 * 2. Transforms raw API response using DataAdapter (dataParser)
 * 3. Updates the Model (buzz store) with parsed data
 * 
 * @class FetchBuzzCommand
 */
export default class FetchBuzzCommand {
  /**
   * Execute the command
   * 
   * Command execution flow:
   * 1. Set loading state in Model
   * 2. Call BusinessDelegate to fetch data from service
   * 3. Transform raw data using DataAdapter (dataParser)
   * 4. Update Model with transformed data
   * 
   * @param {Object} params - Command parameters
   * @param {Object} params.payload - Event payload
   *   - cursor: {number} - Pagination cursor (default: 0)
   *   - size: {number} - Number of items to fetch (default: 30)
   *   - path: {string} - PIN path to fetch (default: '/protocols/simplebuzz')
   * @param {Object} params.stores - Alpine stores object
   *   - buzz: {Object} - Buzz store (list, isLoading, error)
   * @param {Function} params.delegate - BusinessDelegate function for API calls
   * @returns {Promise<void>}
   */
  async execute({ payload = {}, stores, delegate }) {
    // Resolve store (support both old and new API)
    const store = stores.buzz || stores;
    // Set loading state
    store.isLoading = true;
    store.error = null;

    try {
      // Extract parameters from payload or use defaults
      const cursor = payload.cursor || 0;
      const size = payload.size || 30;
      const path = payload.path || '/protocols/simplebuzz';

      // Build endpoint
      const endpoint = `/pin/path/list?cursor=${cursor}&size=${size}&path=${path}`;

      // Fetch data using BusinessDelegate
      const rawData = await delegate('metaid_man', endpoint);

      // Parse and transform data
      const parsedData = this.dataParser(rawData);

      // Update store - ensure Alpine reactivity
      // Direct assignment should work with Alpine's reactive proxy
      store.list = parsedData;
      store.isLoading = false;
      store.error = null;

      // Fetch user information for each unique author in the list
      // This ensures user avatars and names are available for display
      if (parsedData.length > 0 && stores.user) {
        const uniqueMetaIds = [...new Set(parsedData.map(item => item.author).filter(Boolean))];
        
        for (const metaid of uniqueMetaIds) {
          // Only fetch if not already in store
          // Support both stores.user.users[metaid] and stores.user.user structure
          const users = stores.user.users || {};
          const currentUser = stores.user.user || {};
          const isUserLoaded = users[metaid] || (currentUser.metaid === metaid);
          
          if (!isUserLoaded) {
            // Dispatch fetchUser command asynchronously (don't await to avoid blocking)
            IDFramework.dispatch('fetchUser', { metaid }).catch(err => {
              console.warn(`Failed to fetch user info for ${metaid}:`, err);
            });
          }
        }
      } else {
        if (!stores.user) {
          console.warn('FetchBuzzCommand: User store not available');
        }
      }
    } catch (error) {
      console.error('FetchBuzzCommand error:', error);
      store.error = error.message || 'Failed to fetch buzz';
      store.isLoading = false;
    }
  }

  /**
   * DataAdapter (DataParser) - Transform raw API response to Model format
   * 
   * This method adapts the raw API response structure to match the application's
   * Buzz model format. This separation allows the Command to work with
   * different API response structures without changing business logic.
   * 
   * API Response Structure: 
   * {
   *   code: 1,
   *   message: "ok",
   *   data: {
   *     list: [...],
   *     nextCursor: "...",
   *     total: number
   *   }
   * }
   * 
   * @param {Object} rawData - Raw API response from BusinessDelegate
   * @returns {Array} Array of simplified buzz objects for Model
   */
  dataParser(rawData) {
    // Extract list from response structure: rawData.data.list
    let items = [];
    
    if (rawData && rawData.data && Array.isArray(rawData.data.list)) {
      items = rawData.data.list;
    } else if (Array.isArray(rawData)) {
      items = rawData;
    } else if (rawData && rawData.data && Array.isArray(rawData.data)) {
      items = rawData.data;
    } else {
      console.warn('API response structure unexpected. Raw data:', rawData);
      return [];
    }

    const parsed = items.map(item => {
      if (!item || typeof item !== 'object') {
        return {
          content: String(item || ''),
          author: 'unknown',
          txid: '',
          _raw: item,
        };
      }

      // Parse contentSummary JSON string to extract actual content
      let content = '';
      if (item.contentSummary) {
        try {
          const summaryObj = JSON.parse(item.contentSummary);
          content = summaryObj.content || '';
        } catch (e) {
          console.warn('Failed to parse contentSummary:', item.contentSummary, e);
          // If parsing fails, use contentSummary as-is or fallback to other fields
          content = item.contentSummary || item.content || '';
        }
      } else {
        // Fallback to direct content fields
        content = item.content || item.summary || item.text || item.body || item.message || '';
      }

      // Extract author from metaid field
      const author = item.metaid || item.pop || item.author || item.creator || item.user || 'unknown';

      // Extract txid from genesisTransaction field
      const txid = item.genesisTransaction || item.id || item.txid || item.transactionId || item.hash || '';

      return {
        content,
        author,
        txid,
        // Preserve original item for potential future use
        _raw: item,
      };
    });
    
    return parsed;
  }
}

