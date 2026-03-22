/**
 * Packet types for the ESP32 UDP buzzer protocol.
 * Used in the "t" field of every UDP packet.
 */
export enum EUdpPacketType {
    /** ESP32 → Server: periodic liveness signal */
    HEARTBEAT = 'HB',
    /** ESP32 → Server: button was pressed */
    PRESS = 'PRESS',
    /** Server → ESP32: current buzzer state */
    STATE = 'STATE',
}
