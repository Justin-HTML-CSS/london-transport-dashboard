import axios from 'axios';

async function query(name){
  try{
    const res = await axios.post('http://localhost:4003/graphql', {
      query: `query ValidateLocation($name: String!){ validateLocation(name: $name){ input found lat lon inLondon } }`,
      variables: { name }
    }, { headers: { 'Content-Type': 'application/json' } });
    console.log(name, JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.error('Error querying', name, err.response?.data || err.message || err);
  }
}

(async ()=>{
  await query('Waterloo');
  await query('SN3 3SG');
})();
