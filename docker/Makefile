NAME := $(shell node -e "console.log(require('../package.json').name)" | sed 's/^@//g' | sed 's/[/]/_/g')
REGISTRY := $(shell node -e "console.log(require('../package.json').docker.registry)")
VERSION := $(shell node -e "console.log(require('../package.json').version)")
IMAGE := $(REGISTRY)/$(NAME)

include docker.mk

%:
	@
