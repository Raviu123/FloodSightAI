- problem statement
    
    # **Track 1: AI for Coastal Flood Intelligence**
    
    ## **Title**
    
    **Predict Before It Happens** — *Al for Coastal Flood Intelligence*
    
    ---
    
    ## **The Big Question**
    
    **Where, when and how severely will flooding hit?**
    
    ## **AI Toolkit**
    
    Time-series forecasting, geospatial AI, explainable ML
    
    ## **The Decision It Supports**
    
    Which zones to warn and respond to first
    
    ---
    
    ## **The Story (Page 5)**
    
    Picture a coastal neighbourhood on a rainy afternoon. The rain is heavy, the tide is climbing, and the drains are already struggling to cope. Will the water reach your street? When? Should the family on the ground floor leave now, or can they wait until evening?
    
    Today's warnings usually stop at "flood risk: high", which is far too broad to act on. Your challenge is to build the AI that answers the questions people actually ask: **where, when, how bad, and who needs help first.**
    
    ---
    
    ## **The Three Objectives (Page 6)**
    
    **1. Predict the flood.**
    
    Estimate the probability and severity of flooding for specific neighbourhoods, and work out when it will begin and when it will peak. Draw on rainfall, tides, storm surge, terrain, drainage, land use and past flood events (historical or simulated data is perfectly fine).
    
    **2. Show who and what is in the way.**
    
    Build dynamic flood-risk maps that highlight vulnerable zones, along with the roads, buildings and critical facilities, such as hospitals and shelters, likely to be affected.
    
    **3. Turn insight into action.**
    
    Explain why a zone is at risk, raise early warnings, and recommend which areas emergency teams should reach first.
    
    ---
    
    ## **Deliverables (Page 7)**
    
    - A working flood-prediction model covering probability, severity, onset time and peak time
    - An interactive dashboard with a live, updating flood-risk map
    - Zone-level alerts, for example: *High Flood Risk, Zone B. Onset 2:40 PM, peak 4:10 PM. Drivers: high tide + 85 mm rain + low elevation*
    - A list of affected roads, buildings and critical facilities for each zone
    - A ranked priority list for emergency response
    - A plain-language explanation of every prediction
    
    ---
    
    ## **General Requirements (Page 4)**
    
    - **Prediction, not just detection.** Tell us what is about to happen, not only what already has.
    - **An explanation.** Say why the AI believes what it believes, in words a non-technical person understands.
    - **A recommended action.** Great systems finish with "here is what to do next".
    - **A working prototype.** Historical or simulated data is fine. A dashboard that runs beats a slide deck that promises.
    
    ---
    
    ## **Evaluation Criteria (Pages 8–9)**
    
    | **Criterion** | **Weight** | **What the judges will look for** |
    | --- | --- | --- |
    | **Prediction quality** | 25 | Sensible modelling choices, tested on historical or simulated events. Judges want to see probability and severity and timing, backed by honest metrics (such as error in onset time, precision/recall or AUC) and a clear explanation of how you validated. |
    | **Local, geospatial depth** | 20 | Neighbourhood-level resolution rather than city-wide guesses. Smart use of elevation, drainage and land-use data, and an accurate mapping of risk onto roads, buildings and critical infrastructure. |
    | **Explainability** | 15 | Can a non-expert see why a zone is flagged? Look for ranked contributing factors (e.g., feature importance or SHAP) translated into everyday language, not just a score. |
    | **Actionability** | 15 | Early warnings that are specific and timely, plus a defensible priority ranking for responders. Does the output tell someone what to do next? |
    | **Dashboard & usability** | 10 | Clear, live, easy to read in seconds. Maps, timelines and alerts should work together as one story. |
    | **Innovation** | 10 | Creative use of the available signals: satellite imagery, computer vision, forecast uncertainty ranges, or a generative-AI briefing for response teams. |
    | **Demo & storytelling** | 5 | A confident walkthrough of a realistic scenario, from incoming data to a decision, within the allotted time. |
    | **Total** | **100** | Bonus points may be awarded for creativity beyond the brief. |