import $ from "jquery"
import _ from "lodash"

import OvercookedSinglePlayerTask from "./js/overcooked-single";
import getOvercookedPolicy from "./js/load_tf_model.js";

import * as Overcooked from "overcook"
let OvercookedMDP = Overcooked.OvercookedMDP;
let Direction = OvercookedMDP.Direction;
let Action = OvercookedMDP.Action;
let [NORTH, SOUTH, EAST, WEST] = Direction.CARDINAL;
let [STAY, INTERACT] = [Direction.STAY, Action.INTERACT];

// Parameters
let PARAMS = {
    MAIN_TRIAL_TIME: 15, //seconds
    TIMESTEP_LENGTH: 150, //milliseconds
    DELIVERY_POINTS: 20,
    PLAYER_INDEX: 1,  // Either 0 or 1
    MODEL_TYPE: 'ppo_bc'  // Either ppo_bc, ppo_sp, or pbt
};

/***********************************
      Main trial order
************************************/


let layouts = {
    "cramped_room":[
        "XXPXX",
        "O  2O",
        "X1  X",
        "XDXSX"
    ],
    "asymmetric_advantages":[
        "XXXXXXXXX",
        "O XSXOX S",
        "X   P 1 X",
        "X2  P   X",
        "XXXDXDXXX"
    ],
    "coordination_ring":[
        "XXXPX",
        "X 1 P",
        "D2X X",
        "O   X",
        "XOSXX"
    ],
    "random0":[
        "XXXPX",
        "O X1P",
        "O2X X",
        "D X X",
        "XXXSX"
    ],
    "random3": [
        "XXXPPXXX",
        "X      X",
        "D XXXX S",
        "X2    1X",
        "XXXOOXXX"
    ]
};

let game;

function startGame(endOfGameCallback) {
    let AGENT_INDEX = 1 - PARAMS.PLAYER_INDEX;
    /***********************************
          Set up websockets server
    ***********************************/
    // let HOST = "https://lit-mesa-15330.herokuapp.com/".replace(/^http/, "ws");
    // let gameserverio = new GameServerIO({HOST});

    let players = [$("#playerZero").val(), $("#playerOne").val()];
    let saveTrajectory = $("#saveTrajectories").is(':checked');
    if (players[0] == 'human' && players[1] == 'human')
    {

        $("#overcooked").html("<h3>Sorry, we can't support humans as both players.  Please make a different dropdown selection and hit Enter</h3>"); 
        endOfGameCallback();
        return;
    } 
    let layout_name = $("#layout").val();
    let game_time = $("#gameTime").val();
    if (game_time > 1800) {
        $("#overcooked").html("<h3>Sorry, please choose a shorter amount of time for the game!</h3>"); 
        endOfGameCallback();
        return;
    }

    let layout = layouts[layout_name];


    $("#overcooked").empty();
    getOvercookedPolicy(players[0], layout_name, 0).then(function(npc_policy_zero) {
	let [N, S, E, W, I] = [NORTH, SOUTH, EAST, WEST, INTERACT];
        getOvercookedPolicy(players[1], layout_name, 1).then(function(npc_policy_one) {
	    function make_policy_from_actions(actions) {
		let index = -1;
		return function (s) {
		    if (index < actions.length - 1) { index += 1; }
		    return actions[index];
		}
	    };
	    // All of these policies are meant for Counter Circuit
	    let smart_alice_actions = [E, E, S, I, N, I, S, I, N, I, S, I, N, I, E, S, I, N, I, S, I, N, I, S, I, N, I, STAY];
	    let smart_you_with_smart_alice_actions = [N, N, W, W, W, S, I, N, I, S, I, N, I, S, I, N, I, E, S, I, N, I, S, I, N, I, S, I, N, I, STAY];
	    let regular_alice_actions = [E, E, S, I, W, W, N, N, E, E, N, I, W, W, S, S, E, E, S, I, W, W, N, N, E, E, N, I, W, W, S, S, E, E, S, I, W, W, N, N, E, E, N, I, STAY];
	    let smart_you_with_regular_alice_actions = [N, N, W, W, S, STAY, STAY, STAY, STAY, STAY, STAY, STAY, STAY, W, S, STAY, STAY, STAY, STAY, STAY, STAY, STAY, STAY, STAY, STAY, E, E, E, S, S, W, W, S, I, E, E, N, N, W, W, N, I, E, E, S, S, W, W, S, I, E, E, N, N, W, W, N, I, E, E, S, S, W, W, S, I, E, E, N, N, W, W, N, I, STAY];
	    let bob_actions = [W, W, S, I, E, E, N, N, W, W, N, I, E, E, S, S, W, W, S, I, E, E, N, N, W, W, N, I, E, E, S, S, W, W, S, I, E, E, N, N, W, W, N, I, STAY];
	    let charlie_actions = regular_alice_actions;

	    // Alice and you coordinate on the best strategy
	    npc_policy_zero = make_policy_from_actions(smart_you_with_smart_alice_actions);
	    npc_policy_one = make_policy_from_actions(smart_alice_actions);

	    // You try the best strategy, Alice stubbornly sticks to the suboptimal strategy
	    // npc_policy_zero = make_policy_from_actions(smart_you_with_regular_alice_actions);
	    // npc_policy_one = make_policy_from_actions(regular_alice_actions);

	    // Bob and Charlie execute the suboptimal strategy
	    // npc_policy_zero = make_policy_from_actions(bob_actions);
	    // npc_policy_one = make_policy_from_actions(charlie_actions);

	    let player_index = null; 
            let npc_policies = {0: npc_policy_zero, 1: npc_policy_one}; 
            if (npc_policies[0] == null) {
                player_index = 0; 
                npc_policies = {1: npc_policy_one}; 
            }
            if (npc_policies[1] == null) {
                player_index = 1; 
                npc_policies = {0: npc_policy_zero}; 
            }
            let mdp_params = {
                "layout_name": layout_name, 
                "num_items_for_soup": 3, 
                "rew_shaping_params": null, 
            }
            game = new OvercookedSinglePlayerTask({
                container_id: "overcooked",
                player_index: player_index,
                start_grid : layout,
                npc_policies: npc_policies,
                mdp_params: mdp_params,
                save_trajectory: saveTrajectory,
                TIMESTEP : PARAMS.TIMESTEP_LENGTH,
                MAX_TIME : game_time, //seconds
                init_orders: ['onion'],
                always_serve: 'onion',
                completion_callback: () => {
                    console.log("Time up");
                    endOfGameCallback();
                },
                DELIVERY_REWARD: PARAMS.DELIVERY_POINTS
            });
            game.init();
            
        });
        
        

    });
}

function endGame() {
    game.close();
}

// Handler to be added to $(document) on keydown when a game is not in
// progress, that will then start the game when Enter is pressed.
function startGameOnEnter(e) {
    // Do nothing for keys other than Enter
    if (e.which !== 13) {
	return;
    }

    disableEnter();
    // Reenable enter handler when the game ends
    startGame(enableEnter);
}

function enableEnter() {
    $(document).keydown(startGameOnEnter);
    $("#control").html("<p>Press enter to begin!</p><p>(make sure you've deselected all input elements first!)</p>");
}

function disableEnter() {
    $(document).off("keydown");
    $("#control").html('<button id="reset" type="button" class="btn btn-primary">Reset</button>');
    $("#reset").click(endGame);
}

$(document).ready(() => {
    enableEnter();
});
