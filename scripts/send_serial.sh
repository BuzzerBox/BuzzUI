#!/bin/bash

prompt="Select Option: "
options=("Buzzer 1" "Buzzer 2" "Buzzer 3" "Buzzer 4" "Buzzer 5" "Buzzer 6" "Buzzer 7" "Buzzer 8" "Buzzer 9" "Release" "Quit")


PS3="$prompt "
select opt in "${options[@]}"
do
    case $opt in
        "Buzzer 1")
            echo -en '\x31' > /tmp/ttyV1
            ;;
        "Buzzer 2")
            echo -en '\x32' > /tmp/ttyV1
            ;;
        "Buzzer 3")
            echo -en '\x33' > /tmp/ttyV1
            ;;
        "Buzzer 4")
            echo -en '\x34' > /tmp/ttyV1
            ;;
        "Buzzer 5")
            echo -en '\x35' > /tmp/ttyV1
            ;;
        "Buzzer 6")
            echo -en '\x36' > /tmp/ttyV1
            ;;
        "Buzzer 7")
            echo -en '\x37' > /tmp/ttyV1
            ;;
        "Buzzer 8")
            echo -en '\x38' > /tmp/ttyV1
            ;;
        "Buzzer 9")
            echo -en '\x39' > /tmp/ttyV1
            ;;
        "Buzzer 10")
            echo -en '\x30' > /tmp/ttyV1
            ;;
        "Release")
            echo -en '\x71' > /tmp/ttyV1
            ;;
        "Quit")
            break
            ;;
        *) echo "invalid option $REPLY";;
    esac
done
