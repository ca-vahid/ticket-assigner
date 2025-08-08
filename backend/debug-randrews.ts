// Debug script to understand why randrews@bgcengineering.ca shows 0 tickets

console.log(`
=== Debugging randrews@bgcengineering.ca ticket count issue ===

Possible reasons why the agent shows 0 tickets:

1. **Freshservice ID Mismatch**
   - The agent's freshserviceId in the database might not match their actual Freshservice agent ID
   - Tickets use responder_id field which must match the agent's Freshservice ID

2. **Workspace Filter Issue**
   - Agent sync only imports agents from IT workspace (ID: 2)
   - If randrews is not in the IT workspace, they won't be synced properly

3. **Ticket Assignment Method**
   - The sync looks for tickets where responder_id === agent.freshserviceId
   - If tickets are assigned differently (e.g., through groups), they won't be counted

4. **Ticket Status Filter**
   - Only tickets with status 2 (Open) or 3 (Pending) are counted
   - Resolved/Closed tickets are excluded

5. **Data Sync Issue**
   - The agent might need to be re-synced from Freshservice
   - The ticket counts might not have been updated recently

=== Recommended debugging steps ===

1. Check the agent's Freshservice ID in the database:
   - Look for randrews in the agents table
   - Note their freshservice_id value

2. Verify in Freshservice:
   - Login to Freshservice admin panel
   - Find the agent "R Andrews" 
   - Check their agent ID in Freshservice
   - Verify they are in the IT workspace

3. Check ticket assignment:
   - In Freshservice, look at tickets assigned to this agent
   - Check if the responder_id field matches the agent's ID

4. Re-sync the data:
   - Click "Sync Agents" button to update agent data
   - Click "Update Tickets" to refresh ticket counts

5. Manual verification:
   - Use Freshservice API directly to query:
     GET /api/v2/agents?email=randrews@bgcengineering.ca
     GET /api/v2/tickets?responder_id=[agent_id]&status=2

The issue is likely that either:
- The Freshservice ID is incorrect/missing for this agent
- The agent is not properly synced from the IT workspace
- Tickets are assigned through a group rather than directly
`);