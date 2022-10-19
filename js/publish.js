const secret = "verysecret";
const drogue_url = "https://http.sandbox.drogue.cloud/v1/scores";
const application = "jsgame";
const device = "client";

const auth = btoa(device+"@"+application+":"+secret)

async function publishScore (user, score) {
    let payload = {
        name: user,
        score: score,
        date: Date.now()
    }

    const response = await fetch(drogue_url, {
        method: "POST",
        body: JSON.stringify(payload),
        mode: 'no-cors',
        headers: {
            "Content-Type": "application/json",
            'Authorization': 'Basic '+auth,
        }
    })

    if (!response.ok) {
        throw new Error(`Failed to publish score: ${response.status}`)
    }

    console.log("Score published successfully !!")
}