(async()=>{
    "use strict";

    // Dependencies
    const { runJobs } = require("parallel-park")
    const tf = require("@tensorflow/tfjs-node")
    const revolt = require("revolt.js")
    const nsfwJS = require("nsfwjs")
    const axios = require("axios")
    const _ = require("lodash")

    // Variables
    const RevBuster = {
        regex: /(https?|ftps?|mailto):\/\/([-\w\.]+)+(:\d+)?(\/([\w/_\.]*(\?\S+)?)?)?/,
        token: ""
    }

    const client = new revolt.Client()


    // Main
    client.on("ready", ()=>{
        console.log("RevBuster is running.")
    })

    client.on("message", async(message)=>{
        var links = []

        if(message.attachments) for( const attachment of message.attachments ) links.push(`https://autumn.revolt.chat/attachments/${attachment._id}/`)
        if(message.content.match(RevBuster.regex)) for( const link of message.content.match(new RegExp(RevBuster.regex, "g"))) links.push(link)

        links = _.uniq(links)

        if(links.length){
            var nsfw = false
        
            const results = await runJobs(
                links,
                async(link, index, max)=>{
                    try{
                        const response = await axios(link, {
                            responseType: "arraybuffer"
                        })
    
                        if(response.headers["content-type"].indexOf("image") !== -1){
                            const model = await nsfwJS.load()
                            const image = await tf.node.decodeImage(response.data, 3)
                            const predictions = await model.classify(image)
                            image.dispose()
                            
                            return predictions
                        }
                    }catch{}
                }
            )
    
            for( const result of results ){
                result[2].probability = +result[2].probability.toString().replace(/[A-z]|-/g, "")
                result[3].probability = +result[3].probability.toString().replace(/[A-z]|-/g, "")
                result[4].probability = +result[4].probability.toString().replace(/[A-z]|-/g, "")
    
                if(result[2].probability > 0.10 || result[3].probability > 0.10 || result[4].probability > 0.10){
                    nsfw = "high"
                }else{
                    if(result[2].probability > 0.03 || result[3].probability > 0.03 || result[4].probability > 0.03) nsfw = "low"
                }
            }
    
            if(nsfw === "high"){
                message.channel.sendMessage(`NSFW image found sent by ${message.author.username}`)
            }else if(nsfw === "low"){
                message.channel.sendMessage(`Potential NSFW image found sent by ${message.author.username}`)
            }
        }

        var response = await axios("https://toxicity-api.com/", {
            method: "POST",
            headers: {
                "content-type": "application/json"
            },
            data: { messages: message.content}
        })

        response = response.data.clasification

        if(_.find(response, { label: "toxicity" }).results[0].match) message.channel.sendMessage(`Toxic message found sent by ${message.author.username}`)
    })

    client.loginBot(RevBuster.token)
})()