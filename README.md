# Present PBB - Performance-Based Budgeting Application

A modern, clean web application for uploading and visualizing priority-based budgeting data with interactive charts and analysis tools.

## 🚀 Quick Start

### Prerequisites

Make sure you have these installed on your Mac:

```bash
# Install Homebrew (if not already installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install required tools
brew install python@3.11 node postgresql
brew services start postgresql
```

### Setup Project

1. **Create the project structure:**
   Run the project setup script to create all folders and files.

2. **Copy all code files** from the artifacts provided by Claude into their respective locations in the project structure.

3. **Run the setup script:**

```bash
# Navigate to project directory
cd present-pbb

# Make setup script executable and run it
chmod +x setup.sh
./setup.sh
```

### Start Development Servers

**Terminal 1 - Backend:**
```bash
cd present-pbb/backend
source .venv/bin/activate
uvicorn app.main:app --reload
```

**Terminal 2 - Frontend:**
```bash
cd present-pbb/frontend
npm run dev
```

### Access the Application

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:8000
- **API Documentation:** http://localhost:8000/docs

## 📁 Project Structure

```
present-pbb/
├── backend/                    # Python FastAPI backend
│   ├── app/
│   │   ├── api/               # API route handlers
│   │   │   ├── admin.py       # File upload endpoint
│   │   │   ├── programs.py    # Program data endpoints
│   │   │   └── charts.py      # Chart data endpoints
│   │   ├── core/              # Core configuration
│   │   │   ├── config.py      # Settings and environment
│   │   │   └── database.py    # Database connection
│   │   ├── models/            # SQLAlchemy models
│   │   │   └── models.py      # Database table definitions
│   │   ├── services/          # Business logic
│   │   │   └── ingestion.py   # Excel file parsing
│   │   └── main.py            # FastAPI application
│   ├── alembic/               # Database migrations
│   └── requirements.txt       # Python dependencies
├── frontend/                   # React TypeScript frontend
│   ├── src/
│   │   ├── components/        # Reusable UI components
│   │   │   ├── DatasetPicker.tsx
│   │   │   ├── BubbleChart.tsx
│   │   │   ├── SpendingChart.tsx
│   │   │   └── ProgramDrawer.tsx
│   │   ├── pages/             # Main page components
│   │   │   ├── Results.tsx    # Priority analysis
│   │   │   ├── Attributes.tsx # Program attributes
│   │   │   ├── PolicyQuestions.tsx
│   │   │   ├── Costing.tsx    # Cost analysis
│   │   │   └── Admin.tsx      # File upload
│   │   └── App.tsx            # Main application
│   ├── package.json           # Node dependencies
│   └── vite.config.ts         # Build configuration
├── infra/
│   └── render.yaml            # Deployment configuration
├── .env                       # Environment variables
└── README.md
```

## 📊 Features

### 1. Admin Panel (`/admin`)
- Upload Excel "Summary Report" files
- Automatic parsing of "Programs Inventory" and "Details" sheets
- Real-time feedback on upload progress and results
- Dataset management

### 2. Results View (`/results`)
- **Community/Governance Priority Tabs**
- **Spending by Priority:** Bar charts showing total spending per priority
- **Program Alignment Bubbles:** Programs sized by budget, shaded by priority alignment
- **Interactive:** Click priorities to filter, click bubbles for program details

### 3. Basic Program Attributes (`/attributes`)
- Bubble charts with attribute-based shading:
  - Reliance
  - Population Served
  - Demand
  - Cost Recovery
  - Mandate

### 4. Policy Questions (`/policy-questions`)
- Filter programs by policy priorities
- Visual representations of program alignment
- Filterable data tables

### 5. Program Costing (`/costing`)
- **Four analysis modes:**
  - FTE emphasis (shaded by staff intensity)
  - Personnel costs (shaded by personnel %)
  - Non-Personnel costs (shaded by operations %)
  - Fee Recovery (shaded by revenue opportunity)

### 6. Program Details
- **Drill-down capability:** Click any program bubble
- **Detailed breakdown:** Costs, organization, attributes, priority scores
- **Line item access:** View detailed accounting data

## 📋 Excel File Format

Your Summary Report Excel file must contain these sheets:

### "Programs Inventory" Sheet
Required columns:
- `program_id` - Unique identifier
- `Program` - Program name
- `Program Description`
- `Service Type`
- `User Group`
- `Final Score`
- `Quartile`
- `Budget label`
- `Personnel` - Personnel costs
- `NonPersonnel` - Operating costs
- `Revenue` - Fee recovery
- `FTE` - Full-time equivalents

### "Details" Sheet
Required columns:
- `program_id` - Links to Programs Inventory
- `Department`, `Division`, `Activity` - Organizational structure
- `Cost Type` - Personnel/NonPersonnel
- `AcctType`, `AcctNumber` - Account details
- `Total Item Cost`, `Allocation` - Financial details
- `Reliance`, `Population Served`, `Demand`, `Cost Recovery`, `Mandate` - Attributes
- Priority columns like `Connected Neighbors`, `Safety and Security`, etc.

## 🔧 Configuration

### Environment Variables (.env)
```bash
# Database
DATABASE_URL=postgresql://localhost/present_pbb

# Security
ADMIN_SECRET=your-secret-key-here

# CORS
CORS_ORIGINS=["http://localhost:3000", "http://localhost:5173"]
```

### Admin Access
- Use the admin secret when uploading files
- Default: `your-secret-key-change-this`
- Change this in production!

## 🚢 Deployment

### Render.com Deployment

1. **Create GitHub repository:**
```bash
git init
git add .
git commit -m "Initial Present PBB setup"
gh repo create present-pbb --private --source=. --push
```

2. **Deploy to Render:**
- Go to render.com
- New → Blueprint
- Connect to your GitHub repo
- Render will automatically detect `infra/render.yaml`
- Update environment variables in Render dashboard

3. **Post-deployment:**
- Set `ADMIN_SECRET` in Render environment
- Upload your Excel file via the admin panel
- Your app will be available at your Render URL

### Local Development Commands

```bash
# Backend development
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000

# Frontend development  
cd frontend
npm run dev

# Database operations
createdb present_pbb                    # Create database
psql present_pbb                       # Connect to database
```

## 🔍 API Endpoints

### Admin
- `POST /api/admin/upload` - Upload Excel file (requires `x-admin-secret` header)

### Data
- `GET /api/datasets` - List all datasets
- `GET /api/programs` - List programs with filtering
- `GET /api/programs/{id}` - Get program details

### Charts
- `GET /api/charts/spending-by-priority` - Priority spending data
- `GET /api/charts/bubbles/results` - Results bubble chart data
- `GET /api/charts/bubbles/attributes` - Attributes bubble chart data
- `GET /api/charts/bubbles/costing` - Costing bubble chart data

## 🛠️ Development Tips

### Debugging
- Backend logs: Check terminal running uvicorn
- Frontend logs: Open browser dev tools
- Database: Use `psql present_pbb` to inspect data
- API testing: Visit http://localhost:8000/docs for interactive API docs

### Common Issues
- **Database connection:** Ensure PostgreSQL is running (`brew services start postgresql`)
- **Port conflicts:** Backend uses 8000, frontend uses 3000
- **File upload fails:** Check admin secret and file format
- **CORS errors:** Verify CORS_ORIGINS in .env matches frontend URL

### Adding Features
- **New charts:** Add endpoints in `backend/app/api/charts.py`
- **UI components:** Create in `frontend/src/components/`
- **Database changes:** Use Alembic migrations
- **New pages:** Add routes in `frontend/src/App.tsx`

## 📚 Technology Stack

**Backend:**
- Python 3.11 + FastAPI
- SQLAlchemy + PostgreSQL
- Pandas + openpyxl (Excel processing)
- Alembic (database migrations)

**Frontend:**
- React 18 + TypeScript
- Vite (build tool)
- Tailwind CSS (styling)
- Recharts (data visualization)
- React Router (navigation)

## 🤝 Support

If you encounter issues:

1. **Check logs** in both terminal windows
2. **Verify file format** matches the required Excel structure
3. **Confirm database** is running and accessible
4. **Review environment variables** in .env file

For additional help, refer to the individual component files which include detailed comments and error handling.

---

**Ready to get started?** Run the setup script and start exploring your performance-based budgeting data!