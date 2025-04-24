/**
 * WebSocket Connection Manager
 * 
 * Handles WebSocket connections with automatic reconnection and state management.
 */
class WebSocketManager {
    /**
     * Create a new WebSocket Manager
     * @param {string} serverUrl - The WebSocket server URL (e.g., 'ws://127.0.0.1:8000/ws/')
     * @param {string} clientId - Unique identifier for this client (usually username)
     * @param {Object} options - Configuration options
     */
    constructor(serverUrl, clientId, options = {}) {
        this.serverUrl = serverUrl;
        this.clientId = clientId;
        this.socket = null;
        this.connected = false;
        this.reconnectAttempts = 0;
        this.reconnecting = false;
        this.pingInterval = null;
        
        // Default options
        this.options = {
            reconnectInterval: 1000,
            maxReconnectAttempts: 5,
            reconnectBackoffMultiplier: 1.5,
            pingIntervalTime: 30000,
            debug: false,
            ...options
        };
        
        // Event callbacks
        this.eventHandlers = {
            'connect': [],
            'disconnect': [],
            'reconnect': [],
            'message': [],
            'error': [],
            'game_update': [],
            'chat': [],
            'player_joined': [],
            'connection_state': [],
        };
        
        // Track rooms the client is in
        this.rooms = [];
    }
    
    /**
     * Connect to the WebSocket server
     * @returns {Promise} Resolves when connected
     */
    connect() {
        return new Promise((resolve, reject) => {
            try {
                const fullUrl = `${this.serverUrl}${this.clientId}`;
                this.log(`Connecting to ${fullUrl}`);
                
                this.socket = new WebSocket(fullUrl);
                
                this.socket.onopen = () => {
                    this.connected = true;
                    this.reconnectAttempts = 0;
                    this.reconnecting = false;
                    
                    this.log('WebSocket connection established');
                    this._startPingInterval();
                    
                    // If reconnecting, send client state
                    if (this.reconnecting) {
                        this.sendMessage({
                            type: 'reconnect_info',
                            rooms: this.rooms
                        });
                        this._triggerEvent('reconnect');
                    } else {
                        this._triggerEvent('connect');
                    }
                    
                    resolve();
                };
                
                this.socket.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        this.log('Received message:', data);
                        
                        // Handle message based on type
                        if (data.type === 'pong') {
                            // Ping-pong for keep-alive
                            this.lastPongTime = Date.now();
                        } else if (data.type === 'connection_state') {
                            // Server sending current state after connection
                            if (data.data && data.data.rooms) {
                                this.rooms = data.data.rooms;
                            }
                            this._triggerEvent('connection_state', data.data);
                        } else {
                            // Trigger specific event type and general message event
                            this._triggerEvent(data.type, data.data);
                            this._triggerEvent('message', data);
                        }
                    } catch (error) {
                        this.log('Error parsing message:', error);
                        this._triggerEvent('error', { 
                            type: 'parse_error', 
                            error, 
                            data: event.data 
                        });
                    }
                };
                
                this.socket.onclose = (event) => {
                    this.connected = false;
                    this._clearPingInterval();
                    
                    this.log(`WebSocket closed: ${event.code} ${event.reason}`);
                    this._triggerEvent('disconnect', { code: event.code, reason: event.reason });
                    
                    // Attempt to reconnect
                    this._attemptReconnect();
                };
                
                this.socket.onerror = (error) => {
                    this.log('WebSocket error:', error);
                    this._triggerEvent('error', { type: 'connection_error', error });
                    
                    // Close might not be called after error in some browsers
                    if (this.connected) {
                        this.connected = false;
                        this._clearPingInterval();
                        this._attemptReconnect();
                    }
                    
                    if (!this.reconnecting) {
                        reject(error);
                    }
                };
            } catch (error) {
                this.log('Failed to create WebSocket:', error);
                this._triggerEvent('error', { type: 'connection_init_error', error });
                reject(error);
                
                // Attempt to reconnect
                this._attemptReconnect();
            }
        });
    }
    
    /**
     * Disconnect from the WebSocket server
     */
    disconnect() {
        if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
            this.log('Disconnecting...');
            this._clearPingInterval();
            this.socket.close(1000, 'Client disconnected');
            this.connected = false;
        }
    }
    
    /**
     * Send a message to the server
     * @param {Object} message - The message to send
     * @returns {boolean} Success status
     */
    sendMessage(message) {
        if (!this.connected || !this.socket || this.socket.readyState !== WebSocket.OPEN) {
            this.log('Cannot send message, not connected');
            return false;
        }
        
        try {
            const messageStr = JSON.stringify(message);
            this.socket.send(messageStr);
            this.log('Sent message:', message);
            return true;
        } catch (error) {
            this.log('Error sending message:', error);
            this._triggerEvent('error', { type: 'send_error', error, message });
            return false;
        }
    }
    
    /**
     * Send a chat message to a room
     * @param {string} roomId - The room ID
     * @param {string} message - The message text
     * @returns {boolean} Success status
     */
    sendChatMessage(roomId, message) {
        return this.sendMessage({
            type: 'chat',
            room_id: roomId,
            username: this.clientId,
            message
        });
    }
    
    /**
     * Send a game action to a room
     * @param {string} roomId - The room ID
     * @param {string} action - The action type (e.g., 'fold', 'call', 'raise')
     * @param {number} amount - The bet amount (if applicable)
     * @returns {boolean} Success status
     */
    sendGameAction(roomId, action, amount = 0) {
        return this.sendMessage({
            type: 'game_action',
            room_id: roomId,
            username: this.clientId,
            action,
            amount
        });
    }
    
    /**
     * Notify the server that you joined a room
     * @param {string} roomId - The room ID
     * @returns {boolean} Success status
     */
    joinRoom(roomId) {
        if (this.sendMessage({
            type: 'join_room',
            room_id: roomId,
            username: this.clientId
        })) {
            // Add to tracked rooms
            if (!this.rooms.some(r => r.room_id === roomId)) {
                this.rooms.push({ room_id: roomId });
            }
            return true;
        }
        return false;
    }
    
    /**
     * Register an event handler
     * @param {string} event - Event name
     * @param {Function} callback - Event handler function
     * @returns {Function} Function to remove this handler
     */
    on(event, callback) {
        if (!this.eventHandlers[event]) {
            this.eventHandlers[event] = [];
        }
        
        this.eventHandlers[event].push(callback);
        
        // Return a function to remove this handler
        return () => {
            this.off(event, callback);
        };
    }
    
    /**
     * Remove an event handler
     * @param {string} event - Event name
     * @param {Function} callback - Event handler function to remove
     */
    off(event, callback) {
        if (this.eventHandlers[event]) {
            this.eventHandlers[event] = this.eventHandlers[event].filter(
                handler => handler !== callback
            );
        }
    }
    
    /**
     * Start keeping the connection alive with pings
     */
    _startPingInterval() {
        this._clearPingInterval();
        
        this.pingInterval = setInterval(() => {
            if (this.connected) {
                this.sendMessage({ type: 'ping', timestamp: Date.now() });
            }
        }, this.options.pingIntervalTime);
    }
    
    /**
     * Clear the ping interval
     */
    _clearPingInterval() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }
    
    /**
     * Attempt to reconnect to the server
     */
    _attemptReconnect() {
        if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
            this.log('Max reconnect attempts reached, giving up');
            return;
        }
        
        this.reconnectAttempts++;
        this.reconnecting = true;
        
        const delay = this.options.reconnectInterval * 
            Math.pow(this.options.reconnectBackoffMultiplier, this.reconnectAttempts - 1);
        
        this.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
        
        setTimeout(() => {
            if (!this.connected) {
                this.connect().catch(error => {
                    this.log('Reconnect attempt failed:', error);
                });
            }
        }, delay);
    }
    
    /**
     * Trigger an event and call all registered handlers
     * @param {string} event - Event name
     * @param {any} data - Event data
     */
    _triggerEvent(event, data) {
        if (this.eventHandlers[event]) {
            for (const handler of this.eventHandlers[event]) {
                try {
                    handler(data);
                } catch (error) {
                    console.error(`Error in ${event} event handler:`, error);
                }
            }
        }
    }
    
    /**
     * Log a message if debug mode is enabled
     */
    log(...args) {
        if (this.options.debug) {
            console.log('[WebSocketManager]', ...args);
        }
    }
}