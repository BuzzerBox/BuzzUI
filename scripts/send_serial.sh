#!/bin/bash

prompt="Select Option: "
options=("Buzzer 1" "Buzzer 2" "Buzzer 3" "Buzzer 4" "Buzzer 5" "Buzzer 6" "Buzzer 7" "Buzzer 8" "Buzzer 9" "Buzzer 10" "Release" "Quit")
bytes=('\x31' '\x32' '\x33' '\x34' '\x35' '\x36' '\x37' '\x38' '\x39' '\x40' '\x71')

port=/tmp/ttyV1

PS3="$prompt "
select opt in "${options[@]}"
do
    case $opt in
        "${options[0]}")
            echo -en  "${bytes[0]}" > $port
            ;;
        "${options[1]}")
            echo -en "${bytes[1]}" > $port
            ;;
        "${options[2]}")
            echo -en "${bytes[2]}" > $port
            ;;
        "${options[3]}")
            echo -en "${bytes[3]}" > $port
            ;;
        "${options[4]}")
            echo -en "${bytes[4]}" > $port
            ;;
        "${options[5]}")
            echo -en "${bytes[5]}" > $port
            ;;
        "${options[6]}")
            echo -en "${bytes[6]}" > $port
            ;;
        "${options[7]}")
            echo -en "${bytes[7]}" > $port
            ;;
        "${options[8]}")
            echo -en "${bytes[8]}" > $port
            ;;
        "${options[9]}")
            echo -en "${bytes[9]}" > $port
            ;;
        "${options[10]}")
            echo -en "${bytes[10]}" > $port
            ;;
        "${options[11]}")
            break
            ;;
        *) echo "invalid option $REPLY";;
    esac
done
