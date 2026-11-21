#include "usb_mode.h"

void UsbMode::onContact(uint32_t nowMs) {
    hadContact = true;
    lastContactMs = nowMs;
}

UsbMode::Change UsbMode::update(uint32_t nowMs, bool usbConnected) {
    if (!usbConnected) {
        // a new cable needs a new BUZZ LINK
        hadContact = false;
    }
    bool shouldLink = usbConnected && hadContact && since(nowMs, lastContactMs) <= timeouts.contactMs;
    if (shouldLink == linked) {
        return Change::NONE;
    }
    linked = shouldLink;
    return linked ? Change::TO_USB : Change::TO_WIFI;
}

bool UsbMode::sendsPressOverWifi(bool linked, int sends, int usbOnlySends) {
    return !linked || sends >= usbOnlySends;
}
