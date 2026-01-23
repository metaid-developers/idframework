/**
 * GameScoresCommand - Business Logic for recording game scores
 * 
 * Command Pattern implementation following IDFramework architecture.
 * 
 * This command:
 * 1. Validates the game score data
 * 2. Constructs the GameScoreRecording protocol body
 * 3. Uses framework's built-in createPin command to create the PIN on blockchain
 * 
 * @class GameScoresCommand
 */
export default class GameScoresCommand {
  /**
   * Execute the command
   * 
   * Command execution flow:
   * 1. Validate input (metaAppPinId, score, gameName)
   * 2. Construct recordCreator from user store
   * 3. Use framework's createPin to create PIN on blockchain
   * 
   * @param {Object} params - Command parameters
   * @param {Object} params.payload - Event payload
   *   - metaAppPinId: {string} - PinId of the specified MetaApp game application
   *   - score: {number} - Final game score
   *   - gameName: {string} - Game name (e.g., "2048")
   * @param {Object} params.stores - Alpine stores object
   *   - wallet: {Object} - Wallet store (isConnected, address, etc.)
   *   - app: {Object} - App store (isLogin, userAddress, etc.)
   *   - user: {Object} - User store (user.metaid, user.address, etc.)
   * @param {Function} params.delegate - BusinessDelegate function for API calls (not used in this command)
   * @returns {Promise<Object>} Created PIN result
   */
  async execute({ payload = {}, stores, delegate }) {
    try {
      const { metaAppPinId, score, gameName,metaData } = payload;
      
      // Validate required fields
      if (!metaAppPinId) {
        throw new Error('metaAppPinId is required');
      }

      if (typeof score !== 'number' && score !== undefined) {
        throw new Error('score must be a number');
      }

     
      // Check if wallet is connected
      if (!stores.wallet || !stores.wallet.isConnected) {
        throw new Error('Wallet must be connected to record game score');
      }

      // Get user info from stores
      const userStore = stores.user || {};
      const userData = userStore.user || {};
      const metaid = userData.metaid || '';
      const address = userData.address || stores.wallet.address || '';

      if (!metaid) {
        throw new Error('User metaid is required. Please ensure user info is loaded.');
      }

      if (!address) {
        throw new Error('User address is required. Please ensure wallet is connected.');
      }

      // Construct recordCreator as JSON string
      const recordCreator = {
        metaid: metaid,
        address: address
      };

      // Construct body for GameScoreRecording protocol
      const body = {
        metaAppPinId: metaAppPinId,
        recordCreator: recordCreator,
        createTime: Date.now(),
        score: score || 0,
        gameName: gameName,
        metaData:metaData
      };
      
      // Use framework's built-in createPin command to create the PIN
      const pinResult = await IDFramework.BuiltInCommands.createPin({
        payload: {
          operation: 'create',
          body: JSON.stringify(body),
          path: '/protocols/gamescorerecording',
          contentType: 'application/json'
        },
        stores: stores
      });
      
      console.log('Game score recorded successfully:', pinResult);
      return pinResult;
    } catch (error) {
      console.error('GameScoresCommand error:', error);
      // Update error state if store has error property
      if (stores.user) {
        stores.user.error = error.message || 'Failed to record game score';
      }
      throw error;
    }
  }
}
