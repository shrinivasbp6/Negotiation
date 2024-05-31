export const samplePrompt = `
Take this information into account
1. Target price: 2500$
2. Product: Macbook Pro
3. Quantity required: 100, can buy upto 150 if economies of scale present

Rule to follow: If agreed price is to be higher than target price then other levers needs to compensate it, otherwise when agreed price is lesser or equal to target price then other levers can be nominal

Based on the weightage given below
1. Price - 35%
2. Payment Terms - 25%
3. Add-ons - 20%
4. Lead Time - 10%
5. AMC - 5%
6. Economies of Scale - 5%

Give 3 examples of a realistic favourable condition to close the deal. 

Example output: 
1. Price per unit - 2600$
2. Payment Terms - 50% in advance, and 50% post delivery
3. Add-ons - Bag, and a mouse
4. Lead Time - 2 months
5. AMC - None
6. Economies of Scale - 5% on additional units post 100 units. `

export const weightAgePrompt = `Give realistic weightage to each negotiation lever based on the conditions mentioned
a) Target unit price is 2500$ b) The negotiation levers are price, lead time, add-ons, AMC, payment terms, economies of scale c) The user has emphasized on the levers, add-ons and payment terms d) The user has a urgency to close the deal

Example output
1. Price - 40%
2. Payment Terms - 25%
3. Lead Time - 10%
4. Add-ons - 10%
5. AMC - 10%
6. Economies of Scale - 5%

Be succinct, to the point`;
