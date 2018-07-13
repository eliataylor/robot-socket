# MotionCell1C Scope of work:

## Objective:
- The purpose of this project is to create a set of nodes within Node-Red capable of programming motion on a 3 axis robot. Some key attributes of this project include: Ease of programming—process should be intuitive and streamline/automate process steps when possible.

## Nodes:

### 1. Homing Node
-    This node is not expected to have any variable parameters. When the flow hits this node, a homing command will be sent to the servos motor controller.
-    Once the homing action is completed, a payload will be passed on to the next process node
-    A global process comment should be updated with “System is Homing”. This comments purpose is to share machine status to the operator.

### 2. Move Node
-    This node will carry several required and optional parameters. These include
  -- "Requested position" for X/Y/Z,
  -- "Speed" in which to move (defaulted to 100%. But editable by the user.  Range from 1-100)
  -- "Move Type" should default to Absolute. Incremental checkbox should be visible for selection.
  -- "Acceleration" should default to 100%. But editable by the user.  Range from 1-100
  -- "Unique point ID": echoed back once the move has been completed. This could be a timestamp.
  -- "User Comment"
-    3 separate boxes should be shown pre-populated with the robots current position. These can be parsed from the JSON from the servos. Within the node parameters menu, an option for “Touchup Position” should be visible incase the user would like to reteach the points after the node has been dropped on screen. These boxes should have 2 decimal place resolution.
-    Once the move has been completed, the payload will be passed on to the next process node.
-    A global process comment should be updated with a customizable “User Comment”. This comment is user specified within a text box. The purpose is to share machine status to the operator.
-    Move should not be initiated if Servo JSON response shows servos as not ready or homing not complete

__connecting a Dashboard UI component to this will be time consuming__

### Wait Node
-    This node is not related to servo motion but intended to help programming a process flow. The intent is to allow a flow to wait for a global variable to equal a specified value before passing on a payload. This node will also have a “timeout” as well
-    This node should have 2 outputs. Output 1 is intended to pass on the payload if the global variable is met within the specified time limit. Output 2 will be used to pass on the payload if the global variable times out.
-    timeout field should be in seconds. Range is from 0.1-60 seconds, __is there a never timeout option?__

### Executable Node (modification of the daemon node)
-    This node will be the connection to the servo application. Commands to and from node-red will pass through this node and connect node-red to the .EXE file running in parallel to node-red.
-    Instead of running commands to the input of this node, the “homing” and “move” nodes should pass their commands behind the scenes to keep the process flow on screen clean. Data coming out of the node is formatted in JSON.
-    Responses from the .exe should be analyzed for their response data to confirm if “move” or “Homing” has been completed (based on echo timestamp)



### Set Torque Node
-    This is a simple node that will forward a torque value for each axis of the controller (three fields for X,Y,Z) Range 0-100

### Reset Node
-    This is a simple node that will forward a reset command to the servo controller
