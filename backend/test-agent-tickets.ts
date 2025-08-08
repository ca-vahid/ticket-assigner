import 'dotenv/config';
import { DataSource } from 'typeorm';
import axios from 'axios';

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USER || 'user',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_NAME || 'ticket_assigner',
  entities: ['src/database/entities/*.entity.ts'],
  synchronize: false,
});

async function investigateAgent() {
  await dataSource.initialize();
  
  // Find the agent
  const agent = await dataSource.query(
    `SELECT * FROM agents WHERE email = 'randrews@bgcengineering.ca'`
  );
  
  if (agent.length === 0) {
    console.log('Agent not found!');
    return;
  }
  
  console.log('\n=== Agent Details ===');
  console.log('Name:', agent[0].first_name, agent[0].last_name);
  console.log('Email:', agent[0].email);
  console.log('Freshservice ID:', agent[0].freshservice_id);
  console.log('Current Ticket Count:', agent[0].current_ticket_count);
  console.log('Weighted Ticket Count:', agent[0].weighted_ticket_count);
  console.log('Ticket Breakdown:', agent[0].ticket_workload_breakdown);
  
  // Now let's check Freshservice directly
  const apiKey = process.env.FRESHSERVICE_API_KEY;
  const domain = process.env.FRESHSERVICE_DOMAIN || 'bgcengineering';
  
  if (!apiKey) {
    console.log('\nNo Freshservice API key configured');
    await dataSource.destroy();
    return;
  }
  
  try {
    // Get tickets from Freshservice
    console.log('\n=== Fetching tickets from Freshservice ===');
    const response = await axios.get(
      `https://${domain}.freshservice.com/api/v2/tickets?per_page=100&include=requester,stats`,
      {
        headers: {
          'Authorization': `Basic ${Buffer.from(apiKey + ':X').toString('base64')}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const allTickets = response.data.tickets;
    console.log('Total tickets fetched:', allTickets.length);
    
    // Filter for this agent's tickets
    const agentFreshserviceId = parseInt(agent[0].freshservice_id);
    const agentTickets = allTickets.filter((ticket: any) => 
      ticket.responder_id === agentFreshserviceId
    );
    
    console.log(`\nTickets assigned to responder_id ${agentFreshserviceId}:`, agentTickets.length);
    
    // Let's also check if tickets might be assigned differently
    const ticketsByEmail = allTickets.filter((ticket: any) => {
      // Check if requester email matches
      if (ticket.requester && ticket.requester.email === agent[0].email) return true;
      // Check custom fields or other fields
      return false;
    });
    
    console.log(`Tickets where requester email matches:`, ticketsByEmail.length);
    
    // Show some sample tickets to understand the structure
    if (agentTickets.length > 0) {
      console.log('\n=== Sample ticket assigned to agent ===');
      console.log(JSON.stringify(agentTickets[0], null, 2));
    }
    
    // Check open/pending tickets specifically
    const openPendingTickets = agentTickets.filter((ticket: any) => 
      ticket.status === 2 || ticket.status === 3
    );
    console.log(`\nOpen/Pending tickets for agent:`, openPendingTickets.length);
    
    // Let's see if there are any tickets with agent's name
    const ticketsByName = allTickets.filter((ticket: any) => {
      const desc = (ticket.description || '').toLowerCase();
      const subject = (ticket.subject || '').toLowerCase();
      return desc.includes('randrews') || subject.includes('randrews') ||
             desc.includes('andrews') || subject.includes('andrews');
    });
    console.log(`\nTickets mentioning agent's name:`, ticketsByName.length);
    
  } catch (error: any) {
    console.error('\nError fetching from Freshservice:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
  
  await dataSource.destroy();
}

investigateAgent().catch(console.error);