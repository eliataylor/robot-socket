# robot-socket testing environment

- in settings.js, edit `httpStatic` with this directory (where you put this repository)
- in a terminal run, `PORT=3080 node-red /[THIS DIRECTORY]/test-suite.json -s /THIS DIRECTORY/settings.js`


- EX.
PORT=3080 node-red /Users/macbookpro/Developer/flexibleassembly/RobotCommNode/motioncell-flow.json -s /Users/macbookpro/Developer/flexibleassembly/RobotCommNode/settings-motioncell.js
