/**
 * PostBuzzCommand - Business Logic for posting a new Buzz
 * 
 * Command Pattern implementation following IDFramework architecture.
 * 
 * This command:
 * 1. Validates the buzz content
 * 2. Uses framework's built-in createPIN command to create the PIN
 * 3. Updates the local store with the new buzz (mock implementation)
 * 
 * In production, the createPIN command would broadcast to blockchain.
 * For now, this is a mock that only updates the local store.
 * 
 * @class PostBuzzCommand
 */
export default class PostBuzzCommand {
  /**
   * Execute the command
   * 
   * Command execution flow:
   * 1. Validate input (content, author)
   * 2. Use framework's createPIN to create PIN (mock)
   * 3. Transform PIN data using DataAdapter
   * 4. Update Model (buzz store)
   * 
   * @param {Object} params - Command parameters
   * @param {Object} params.payload - Event payload
   *   - content: {string} - Buzz content text
   *   - author: {string} - User address/metaid (optional, will use wallet store if not provided)
   *   - path: {string} - PIN path (optional, defaults to '/protocols/simplebuzz')
   * @param {Object} params.stores - Alpine stores object
   *   - wallet: {Object} - Wallet store (isConnected, address, etc.)
   *   - app: {Object} - App store (isLogin, userAddress, etc.)
   *   - buzz: {Object} - Buzz store (list, isLoading, error)
   * @param {Function} params.delegate - BusinessDelegate function for API calls
   * @returns {Promise<void>}
   */
  async execute({ payload = {}, stores, delegate }) {
    try {
      const content = payload.content || '';
      const path = payload.path || '/protocols/simplebuzz';
      
      if (!content || !content.trim()) {
        throw new Error('Buzz content cannot be empty');
      }

      // Get author from payload, wallet store, or throw error
      let author = payload.author || null;
      
      if (!author) {
        // Try to get from wallet store
        if (stores.wallet && stores.wallet.isConnected && stores.wallet.address) {
          author = stores.wallet.address;
        } else if (stores.app && stores.app.isLogin && stores.app.userAddress) {
          author = stores.app.userAddress;
        }
      }

      if (!author) {
        throw new Error('User address is required. Please connect your wallet first.');
      }

      // Use framework's built-in createPIN command to create the PIN
      // This is currently a mock implementation
      const pinResult = await IDFramework.BuiltInCommands.createPIN({
        payload: {
          content: content.trim(),
          path: path,
          contentType: 'application/json;utf-8',
        },
        stores: stores,
      });

      // DataAdapter: Transform PIN result to Buzz model format
      const newBuzz = this.dataAdapter(pinResult, author);

      // Update Model: Add new buzz to the list (prepend for newest first)
      const buzzStore = stores.buzz || stores;
      const currentList = buzzStore.list || [];
      buzzStore.list = [newBuzz, ...currentList];
      buzzStore.error = null;

      console.log('Buzz posted successfully:', newBuzz);
    } catch (error) {
      console.error('PostBuzzCommand error:', error);
      const buzzStore = stores.buzz || stores;
      buzzStore.error = error.message || 'Failed to post buzz';
      throw error;
    }
  }

  /**
   * DataAdapter - Transform raw PIN data to Buzz model format
   * 
   * This method adapts the raw PIN data structure to match the application's
   * Buzz model format. This separation allows the Command to work with
   * different data structures without changing business logic.
   * 
   * @param {Object} pinData - Raw PIN data from createPIN command
   * @param {string} author - User address/metaid
   * @returns {Object} Formatted buzz object for Model
   */
  dataAdapter(pinData, author) {
    return {
      content: pinData.content || '',
      author: author,
      txid: pinData.txid || '',
      _raw: {
        id: pinData.txid || '',
        content: pinData.content || '',
        metaid: author,
        genesisTransaction: pinData.txid || '',
        timestamp: pinData.timestamp || Math.floor(Date.now() / 1000),
        path: pinData.path || '/protocols/simplebuzz',
      }
    };
  }
}

