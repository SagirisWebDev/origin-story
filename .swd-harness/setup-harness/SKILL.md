---
name: setup-harness
description: use when setup-harness skill is called
---
# Overview
- Decide which development context this harness will be used for

## Actions

### 1. Prompt User
- Ask the user what development environment is being used for. Read the `~/Harnesses/context/` directory and return the names of all the skills in the nested directories to the user.
- The skill directly under `context/` is the default skill, it returns any empty context. Include that in the selections returned to the user.
- The user must pick one of the returned names. Store that name in your memory.
- Copy the directory and its contents with the name the user selected into the `.swd-harness/context` directory
- Replace all instances of `{namespace}` in `.swd-harness/skills` with the name the user selected

### 2. Run skill setup
- run the `skills/engineering/setup-matt-pocock-skills` skill