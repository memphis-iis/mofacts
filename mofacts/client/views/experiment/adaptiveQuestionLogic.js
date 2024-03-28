// Adaptive Translator for Logic to Javascript



export default class AdaptiveQuestionLogic{    
    //translate the logic to javascript code
    evaluate(logicString, currentUnit, history){
        //logic string is a string that contains the logic to be evaluated using IF THEN logic, 
        //currentUnit is the current unit that the logic is being evaluated for
        //history is an object that contains a boolean value for each question in each unit
        //example: {U1: {Q1: true, Q2: false}, U2: {Q1: true, Q2: true}}

        // you may use logic operators AND, OR, NOT, and the following variables:
        // Questions (aka Q1), Units (aka U1), and combinations of the two (U1Q1)
        // You may also use numbers, and PEMDAS operators
        // Example: IF Q1 AND Q2 THEN (U1Q1, U2Q2)
        // This would evaluate to true if Q1 and Q2 are true in the history dictionary, and would return a schedule of U1Q1 and U2Q2
        // Example: IF (Q1 AND Q2) OR Q3 THEN (U1Q1, U2Q2, U3Q3)
        // This would evaluate to true if Q1 and Q2 are true or Q3 is true in the history dictionary, and would return a schedule of U1Q1, U2Q2, and U3Q3
        // Example: IF Q1 AND NOT Q2 THEN (U1Q1, U2Q2)
        // This would evaluate to true if Q1 is true and Q2 is false in the history dictionary, and would return a schedule of U1Q1 and U2Q2

        //This returns an object with the following properties:
        // condition: the original condition string
        // conditionExpression: the translated condition string
        // actions: the original action string
        // conditionResult: the result of the condition evaluation
        // schedule: an array of objects with the unit and question to schedule



        console.log('evaluate logicString:', logicString);
        const operators = {
            "NOT": "!",
            "AND": "&&",
            "OR": "||"
        };

        //remove the IF prefix and split on keyword THEN. Before then is the condition, after then is the action
        let parts = logicString.replace("IF", "").split("THEN");
        let condition = parts[0].trim();
        let actions = parts[1].trim();

        //if condition or action is empty, return
        if(!condition || !actions){
            return {condition: condition, action: actions, conditionResult: false};
        }

        //tokenize the condition
        let conditionTokens = condition.split(" ");




        //translate the condition
        let conditionExpression = "";
        // Allowed math operators
        const mathOperators = "+-*/%()=";

        for(const token of conditionTokens){
            if(operators[token]){
                conditionExpression += operators[token];
            } else if (token.startsWith("Q")){
                conditionExpression += `history[currentUnit].${token}`;
            } else if (token.toLowerCase() === "true"){
                conditionExpression += "true";
            } else if (token.toLowerCase() === "false"){
                conditionExpression += "false";
            } else if (Number.isInteger(parseInt(token)) || token.startsWith("U") || token.startsWith("Q")){
                conditionExpression += token;
            } else {
                //loop through each character in the token, if it is a math operator, add it to the expression. Otherwise, throw an error
                for(const char of token){
                    if(mathOperators.includes(char)){
                        conditionExpression += char;
                    } else {
                        //check if a number
                        if(Number.isInteger(parseInt(char))){
                            conditionExpression += char;
                        } else {
                            throw new Error(`Invalid token: ${token}`);
                        }
                    }
                }
            }
        }


        //build a new function that will be called to evaluate the condition
        let conditionFunction = new Function(`return ${conditionExpression}`);

        //evaluate the condition
        let conditionResult = conditionFunction();

        //destroy the function
        conditionFunction = null;

        //if the condition is false, end the function. Otherwise, evaluate the action
        if(!conditionResult){
            return;
        }

        //the action can be either a single action as a string or an array of actions. To check, we will find if parenthesis are present
        console.log('action:', actions);

        let schedule = [];
        
        ///check if there are parenthesis, if so interpret as an array of actions
        if(actions.includes("(")){
            let startIndex = actions.indexOf("(");
            let endIndex = actions.indexOf(")");
            let actionsString = actions.substring(startIndex + 1, endIndex);
            //add each action to the schedule
            for(const action of actionsString.split(",")){
                if(action.startsWith("Q")){
                    schedule.push({
                        unit: currentUnit,
                        question: parseInt(action.split("Q")[1] || 0)
                    });
                }
                if(action.startsWith("U")){
                    //if it has a Q it has a defined question, otherwise it is just a unit and the question is 0
                    if(action.includes("Q")){
                        let parts = action.split("Q");
                        schedule.push({
                            unit: parseInt(parts[0].split("U")[1]),
                            question: parseInt(parts[1])
                        });
                    } else {
                        schedule.push({
                            unit: parseInt(action.split("U")[1]),
                            question: 0
                        });
                    }
                }                
            }
        } else {
            //if no parenthesis, it is a single action. We check if it is a unit and question or just a unit
            if(actions.startsWith("Q")){
                schedule.push({
                    unit: currentUnit,
                    question: parseInt(actions.split("Q")[1] || 0)
                });
            }
            if(actions.startsWith("U")){
                //if it has a Q it has a defined question, otherwise it is just a unit and the question is 0
                if(actions.includes("Q")){
                    let parts = actions.split("Q");
                    schedule.push({
                        unit: parseInt(parts[0].split("U")[1]),
                        question: parseInt(parts[1])
                    });
                } else {
                    schedule.push({
                        unit: parseInt(actions.split("U")[1]),
                        question: 0
                    });
                }
            } 
        }
        return {condition: condition, conditionExpression: conditionExpression, actions: actions, conditionResult: conditionResult, schedule: schedule};
    }
}

