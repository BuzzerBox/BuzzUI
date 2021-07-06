#!/bin/sh
echo "Creating Hotspot"
ip link set dev wlan0 down
ip a add 10.0.0.5/24 brd + dev wlan0
ip link set dev wlan0 up
dhcpcd -k wlan0 >/dev/null 2>&1
systemctl restart dnsmasq
systemctl restart hostapd
