#!/usr/bin/env bash

readonly scriptablePath=~/Library/Mobile\ Documents/iCloud~dk~simonbs~Scriptable/Documents/
readonly currentDirectory="$PWD"

__init() {
  cp {jsconfig,package}.json "$scriptablePath"
  cd "$scriptablePath"
  npm i -D @types/scriptable-ios
  npm i -D @scriptable-ios/eslint-config
  cd "$currentDirectory"
  if [[ -L src ]]; then
    exit 0
  elif [[ -e src ]]; then
    rm src
  fi
  ln -s "$scriptablePath" src
}

__init
