#!/bin/bash

# Passed arguments are documented as follows:
#	  name::type: description
#
# Returns are declared as follows:
#   -> returnType: description
# If a function does not return anything, the return type can be omitted
#
# Example:
#	  file::string: path to the file
#
# To indicate that an argument is no mandatory, a question mark is added and the documentation looks as follow:
#	  ?name::type::defaultValue: description

# TYPE DEF
#   boolean: "true" | "false"
#   booleanNum: 1 | 0

# Backs a file up if it exists.
# file::string: path to the file that is to be backed up
# ?useCopy::boolean::false: Whether the file is to be backed up by copying it instead of renaming it
ensureBackup() {
  # VAR
	file="$1";
	useCopy="$2";

	# check if the file even exists
	if ! [ -f "${file}" ]
  then
    return 0;
  fi

  # check if argument was passed. If not, set default value
	if [ -z "$2" ]
	then
	  useCopy="false";
	fi

  backupFileName="${file}${BACKUP_FILE_NAME_POSTFIX}";
	if [ "${useCopy}" = "true" ]
	then
	  yes | sudo cp "${file}" "${backupFileName}";
	else
	  yes | sudo mv "${file}" "${backupFileName}";
	fi
}
export -f ensureBackup;

# Replaces a string in a file. Does NOT check if the file exists!
# file::string: path to the file something is to be replaced
# toBeReplaced::string: The string whose occurrences are to be replaced
# replacement::string: The string that will replace the occurrences of `toBeReplaced`
# ?delimiter::string::"|": The delimiter for the underlying sed command
replaceInFile() {
  # VAR
  file="$1";
  toBeReplaced="$2";
  replacement="$3";
  delimiter="$4";

  # set default delimiter if it is not set
    if [ -z "${delimiter}" ]
    then
      delimiter="|";
    fi

  sedString="s${delimiter}"
  sedString+="${toBeReplaced}"
  sedString+="${delimiter}"
  sedString+="${replacement}"
  sedString+="${delimiter}"

  sed -i "${sedString}" "${file}"
}
export -f replaceInFile;

# Appends the content of a given file to another file
# fileFrom::string: path to the file whose content is to be appended
# fileTo::string: path to the file where the content of the other file is to be appended
appendContentToFile() {
  # VAR
  fileFrom="$1";
  fileTo="$2";

  cat "${fileFrom}" | sudo tee -a "${fileTo}"
}
export -f appendContentToFile;

# Appends the given text to the given file
# text::string: text that is to be appended
# file::string: path to the file where the text is to be appended
appendTextToFile() {
  # VAR
  text="$1";
  file="$2";

  echo "${text}" | sudo tee -a "${file}";
}
export -f appendTextToFile;

# Sets something in a config file.
# file::string: path to the config file
# key::string: name of the config to be set
# value::string: the value to be set
# ?delimiter::string::"=": The delimiter between key and value, i.e. "key=value"
setInConfigFile() {
  # VAR
  file="$1";
  key="$2";
  value="$3";
  delimiter="$4";

  if ! [ -f "${file}" ]
  then
    echo "Can't set config value since file '${file}' does not exist";
    return;
  fi

  # set default delimiter if it is not set
  if [ -z "${delimiter}" ]
  then
    delimiter="=";
  fi

  isStringInFile "${key}" "${file}";
  isInFile=$?;

  keyValueString="${key}${delimiter}${value}";

  if [ ${isInFile}  -eq 1 ]
  then
    # check if the same value is already set
    isStringInFile "${keyValueString}" "${file}";
    isValueAlreadySet=$?
    if [ ${isValueAlreadySet}  -eq 1 ]
    then
      # the same value is already set, so nothing needs to be done and we can just return
      return;
    fi

    # replace the whole line with the new setting
    replaceInFile "${file}" ".*${key}.*" "${keyValueString}";
  else
    # the value does not exist in the file yet, so we append it
    appendTextToFile "${keyValueString}" "${file}";
  fi
}
export -f setInConfigFile;

# Checks whether a given string exists in the given file
# lookup::string: The string that is to be checked if it exists in the file
# file::string: path to the file
# -> booleanNum: 1 if the string exists in the file, 0 if not
isStringInFile() {
  if grep -Fxq "$FILENAME" my_list.txt
  then
      return 1;
  else
      return 0;
  fi
}
export -f isStringInFile;
