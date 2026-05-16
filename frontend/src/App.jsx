import { useState } from 'react'

function App() {
  const [time, setTime] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault() 

    if (!time) {
      alert('Please select a date and time first!')
      return
    }

    try {
      const response = await fetch('https://your-api-endpoint.com/api/time', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ scheduledTime: time }),
      })

      if (response.ok) {
        alert('Time sent successfully!')
      } else {
        alert('Failed to send time to the server.')
      }
    } catch (error) {
      console.error('Error sending data:', error)
      alert('A network error occurred.')
    }
  }

  return (
    <>
      <div className=''>
        <form onSubmit={handleSubmit}>
          <h1>Check water visibility predictions</h1>
          <input 
            type="datetime-local" 
            value={time}
            onChange={(e) => setTime(e.target.value)}
          /> 
          <button type="submit">Check</button>        
        </form>
      </div>
    </>
  )
}

export default App