from contextlib import asynccontextmanager
from fastapi import FastAPI, APIRouter, HTTPException, Query, Depends, File, UploadFile, BackgroundTasks
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone, date, timedelta
import jwt
from passlib.context import CryptContext
import pandas as pd
import io
import smtplib
from email.message import EmailMessage

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

@asynccontextmanager
async def lifespan(app):
    yield
    client.close()

app = FastAPI(lifespan=lifespan)
api_router = APIRouter(prefix="/api")

# ── Models ──

class Employee(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    email: str
    password_hash: str
    department: str
    role: str = "employee"  # employee, manager, admin
    manager_id: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class EmployeeOut(BaseModel):
    id: str
    name: str
    email: str
    department: str
    role: str
    manager_id: Optional[str] = None
    created_at: str

class EmployeeCreate(BaseModel):
    name: str
    email: str
    department: str
    role: str = "employee"
    password: str
    manager_id: Optional[str] = None

class EmployeeUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    department: Optional[str] = None
    role: Optional[str] = None
    manager_id: Optional[str] = None

class LeaveRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    employee_id: str
    employee_name: str = ""
    leave_type: str = "leave"
    category: Optional[str] = None # sick, casual, personal, emergency
    start_date: str  # ISO date string
    end_date: str
    reason: str
    status: str = "pending"  # pending, approved, rejected
    manager_approval: Optional[str] = None # pending, approved, rejected, not_required
    admin_approval: Optional[str] = None # pending, approved, rejected
    manager_reviewer_id: Optional[str] = None
    manager_reviewer_name: Optional[str] = None
    admin_reviewer_id: Optional[str] = None
    admin_reviewer_name: Optional[str] = None
    is_lop: bool = False
    lop_days: int = 0
    is_read: bool = True
    manager_read: bool = False
    admin_read: bool = False
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class LeaveRequestCreate(BaseModel):
    employee_id: str
    leave_type: str = "leave"
    category: Optional[str] = None
    start_date: str
    start_date: str
    end_date: str
    reason: str

class LeaveStatusUpdate(BaseModel):
    status: str  # approved, rejected
    reviewer_id: str

class Holiday(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    date: str  # YYYY-MM-DD

# ── Leave Allocation (configurable) ──

LEAVE_ALLOCATION = {"leave": 18}

# ── Auth Utilities ──

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
SECRET_KEY = os.environ.get("JWT_SECRET", "supersecretkey123")  # Use env var in prod
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days
security = HTTPBearer()

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    user = await db.employees.find_one({"id": user_id}, {"_id": 0})
    if user is None:
        raise HTTPException(status_code=401, detail="User securely not found")
    return user

class LoginData(BaseModel):
    email: str
    password: str

@api_router.post("/auth/login")
async def login(data: LoginData):
    user = await db.employees.find_one({"email": data.email}, {"_id": 0})
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    
    access_token = create_access_token(data={"sub": user["id"]})
    user_out = {k: v for k, v in user.items() if k != "password_hash"}
    return {"access_token": access_token, "token_type": "bearer", "user": user_out}

@api_router.get("/auth/me", response_model=EmployeeOut)
async def read_users_me(current_user: dict = Depends(get_current_user)):
    return current_user

# ── Helper ──

SMTP_SERVER = os.environ.get("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.environ.get("SMTP_PORT", 587))
SMTP_USERNAME = os.environ.get("SMTP_USERNAME")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")

def send_email_sync(to_emails: List[str], subject: str, content: str):
    if not SMTP_USERNAME or not SMTP_PASSWORD:
        logger.warning(f"SMTP credentials not set, skipping email: {subject}")
        return
    try:
        msg = EmailMessage()
        msg.set_content(content, subtype='html')
        msg['Subject'] = subject
        msg['From'] = SMTP_USERNAME
        msg['To'] = ", ".join(to_emails)
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()
        server.login(str(SMTP_USERNAME), str(SMTP_PASSWORD))
        server.send_message(msg)
        server.quit()
        logger.info(f"Email sent successfully to {to_emails}")
    except Exception as e:
        logger.error(f"Failed to send email to {to_emails}: {e}")

def send_new_leave_email(leave: dict, manager_email: Optional[str], hr_emails: List[str]):
    recipients = hr_emails.copy()
    if manager_email and manager_email not in recipients: 
        recipients.append(manager_email)
    if not recipients: return

    subject = f"New Leave Request: {leave['employee_name']}"
    content = f"""
<p>Hello,</p>
<p>A new leave request has been submitted by <strong>{leave['employee_name']}</strong>.</p>
<p><b>Details:</b><br>
- Dates: {leave['start_date']} to {leave['end_date']}<br>
- Category: {leave.get('category', 'Leave').title() if leave.get('category') else 'Leave'}<br>
- Reason: {leave['reason']}</p>
<p>Please log in to the <a href="{FRONTEND_URL}">LeaveDesk portal</a> to review this request.</p>
<p>Best,<br>LeaveDesk System</p>
"""
    send_email_sync(recipients, subject, content)

def send_leave_status_email(leave: dict, employee_email: str, status: str, reviewer_name: str):
    subject = f"Leave Request Update: {status.capitalize()}"
    content = f"""
<p>Hello <strong>{leave['employee_name']}</strong>,</p>
<p>Your leave request from {leave['start_date']} to {leave['end_date']} has been updated to: <strong>{status.upper()}</strong> by {reviewer_name}.</p>
<p>Please log in to the <a href="{FRONTEND_URL}">LeaveDesk portal</a> for more details.</p>
<p>Best,<br>LeaveDesk System</p>
"""
    send_email_sync([employee_email], subject, content)


async def calc_days(start: str, end: str) -> int:
    s = date.fromisoformat(start)
    e = date.fromisoformat(end)
    
    holiday_docs = await db.holidays.find({
        "date": {"$gte": start, "$lte": end}
    }).to_list(100)
    holiday_dates = {doc["date"] for doc in holiday_docs}

    days = 0
    current = s
    while current <= e:
        curr_str = current.isoformat()
        if current.weekday() < 5 and curr_str not in holiday_dates:  # Mon-Fri
            days += 1
        current += timedelta(days=1)
    return days

# ── Employee Endpoints ──

@api_router.post("/employees", response_model=EmployeeOut)
async def create_employee(data: EmployeeCreate, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only admin can create employees")
        
    existing = await db.employees.find_one({"email": data.email})
    if existing:
        raise HTTPException(status_code=400, detail="That email is already in the club! Use a unique one.")
        
    emp_data = data.model_dump()
    pwd = emp_data.pop("password", "password123")
    emp_data["password_hash"] = get_password_hash(pwd)
    emp = Employee(**emp_data)
    doc = emp.model_dump()
    await db.employees.insert_one(doc)
    
    # Return a dictionary formatted to match EmployeeOut
    out_doc = {k: v for k, v in doc.items() if k != "password_hash"}
    return out_doc

@api_router.get("/employees", response_model=List[EmployeeOut])
async def list_employees(current_user: dict = Depends(get_current_user)):
    query = {}
    if current_user["role"] == "employee":
        query = {"id": current_user["id"]}
    elif current_user["role"] == "manager":
        query = {"$or": [{"id": current_user["id"]}, {"manager_id": current_user["id"]}]}
    docs = await db.employees.find(query, {"_id": 0}).to_list(200)
    return docs

@api_router.get("/employees/{employee_id}", response_model=EmployeeOut)
async def get_employee(employee_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] == "employee" and current_user["id"] != employee_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    doc = await db.employees.find_one({"id": employee_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Employee not found")
    if current_user["role"] == "manager" and current_user["id"] != employee_id and doc.get("manager_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    return doc

@api_router.put("/employees/{employee_id}", response_model=EmployeeOut)
async def update_employee(employee_id: str, data: EmployeeUpdate, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only admin can update employees")
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    await db.employees.update_one({"id": employee_id}, {"$set": updates})
    doc = await db.employees.find_one({"id": employee_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Employee not found")
    return doc

@api_router.delete("/employees/{employee_id}")
async def delete_employee(employee_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only admin can delete employees")
    result = await db.employees.delete_one({"id": employee_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Employee not found")
    await db.leave_requests.delete_many({"employee_id": employee_id})
    return {"message": "Employee deleted"}

# ── Leave Endpoints ──

@api_router.post("/leaves", response_model=LeaveRequest)
async def create_leave(data: LeaveRequestCreate, background_tasks: BackgroundTasks, current_user: dict = Depends(get_current_user)):
    if current_user["role"] == "employee" and data.employee_id != current_user["id"]:
        raise HTTPException(status_code=403, detail="Can only apply for yourself")
    
    emp = await db.employees.find_one({"id": data.employee_id}, {"_id": 0})
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    # Check for overlapping leaves
    overlapping = await db.leave_requests.find_one({
        "employee_id": data.employee_id,
        "status": {"$in": ["pending", "approved"]},
        "$or": [
            {"start_date": {"$lte": data.end_date}, "end_date": {"$gte": data.start_date}}
        ]
    })
    
    if overlapping:
        raise HTTPException(status_code=400, detail="Ouch! This request overlaps with your other plans.")

    # Check balance
    year = date.fromisoformat(data.start_date).year
    balance = await _get_balance(data.employee_id, year)
    days = await calc_days(data.start_date, data.end_date)
    
    if days == 0:
        raise HTTPException(status_code=400, detail="That's a weekend! You're already free then, silly")

    # Always use the combined 'leave' allocation
    lt = "leave"
    
    alloc = LEAVE_ALLOCATION.get(lt, 18)
    used_key = f"{lt}_used"
    available = max(0, alloc - balance.get(used_key, 0))
    
    lop_days = 0
    if days > available:
        lop_days = days - available

    manager_approval = "pending" if emp.get("manager_id") else "not_required"
    if emp["role"] in ["manager", "admin"]:
        manager_approval = "not_required"

    leave = LeaveRequest(
        employee_id=data.employee_id,
        employee_name=emp["name"],
        leave_type="leave",
        category=data.category,
        start_date=data.start_date,
        end_date=data.end_date,
        reason=data.reason,
        status="pending",
        manager_approval=manager_approval,
        admin_approval="pending",
        is_lop=(lop_days > 0),
        lop_days=lop_days
    )
    doc = leave.model_dump()
    await db.leave_requests.insert_one(doc)
    
    # Notify Manager and HR
    manager_email = None
    if emp.get("manager_id"):
        manager = await db.employees.find_one({"id": emp["manager_id"]})
        if manager:
            manager_email = manager.get("email")
    hr_docs = await db.employees.find({"role": "admin"}).to_list(100)
    hr_emails = [h.get("email") for h in hr_docs if h.get("email")]
            
    background_tasks.add_task(send_new_leave_email, doc, manager_email, hr_emails)
    
    return leave

@api_router.get("/leaves", response_model=List[LeaveRequest])
async def list_leaves(
    employee_id: Optional[str] = None,
    status: Optional[str] = None,
    leave_type: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query: dict = {}
    if employee_id:
        query["employee_id"] = employee_id
    if status:
        query["status"] = status
    if leave_type:
        query["leave_type"] = leave_type
        
    if current_user["role"] == "employee":
        query["employee_id"] = current_user["id"]
    elif current_user["role"] == "manager":
        assigned = await db.employees.find({"manager_id": current_user["id"]}, {"id": 1}).to_list(1000)
        assigned_ids = [e["id"] for e in assigned]
        query["$or"] = [
            {"employee_id": current_user["id"]},
            {"employee_id": {"$in": assigned_ids}}
        ]
        
    docs = await db.leave_requests.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return docs

@api_router.get("/leaves/employee/{employee_id}", response_model=List[LeaveRequest])
async def get_employee_leaves(employee_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] == "employee" and current_user["id"] != employee_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    if current_user["role"] == "manager" and current_user["id"] != employee_id:
        emp = await db.employees.find_one({"id": employee_id})
        if not emp or emp.get("manager_id") != current_user["id"]:
            raise HTTPException(status_code=403, detail="Not authorized")
            
    docs = await db.leave_requests.find({"employee_id": employee_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return docs

@api_router.get("/leaves/notifications")
async def get_notifications(current_user: dict = Depends(get_current_user)):
    user_id = current_user["id"]
    role = current_user["role"]

    # 1. My Leaves: any unread updates
    my_leaves_count = await db.leave_requests.count_documents({
        "employee_id": user_id,
        "is_read": {"$ne": True}
    })

    # 2. Team Leaves: new/actionable items for manager/admin
    team_leaves_count = 0
    if role == "manager":
        assigned = await db.employees.find({"manager_id": user_id}, {"id": 1}).to_list(1000)
        assigned_ids = [e["id"] for e in assigned]
        team_leaves_count = await db.leave_requests.count_documents({
            "employee_id": {"$in": assigned_ids},
            "manager_read": {"$ne": True}
        })
    elif role == "admin":
        team_leaves_count = await db.leave_requests.count_documents({
            "admin_read": {"$ne": True}
        })

    return {
        "my_leaves": my_leaves_count,
        "team_leaves": team_leaves_count
    }

@api_router.post("/leaves/mark-read")
async def mark_read(current_user: dict = Depends(get_current_user)):
    await db.leave_requests.update_many(
        {"employee_id": current_user["id"]},
        {"$set": {"is_read": True}}
    )
    return {"message": "Marked as read"}

@api_router.post("/leaves/team/mark-read")
async def mark_team_read(current_user: dict = Depends(get_current_user)):
    role = current_user["role"]
    if role == "manager":
        assigned = await db.employees.find({"manager_id": current_user["id"]}, {"id": 1}).to_list(1000)
        assigned_ids = [e["id"] for e in assigned]
        await db.leave_requests.update_many(
            {"employee_id": {"$in": assigned_ids}},
            {"$set": {"manager_read": True}}
        )
    elif role == "admin":
        await db.leave_requests.update_many(
            {},
            {"$set": {"admin_read": True}}
        )
    return {"message": "Team leaves marked as read"}

@api_router.put("/leaves/{leave_id}/status", response_model=LeaveRequest)
async def update_leave_status(leave_id: str, data: LeaveStatusUpdate, background_tasks: BackgroundTasks, current_user: dict = Depends(get_current_user)):
    if data.status not in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail="Status must be approved or rejected")

    leave = await db.leave_requests.find_one({"id": leave_id}, {"_id": 0})
    if not leave:
        raise HTTPException(status_code=404, detail="Leave request not found")
        
    emp = await db.employees.find_one({"id": leave["employee_id"]})
    
    update_fields = {}
    
    if current_user["role"] == "manager":
        if emp.get("manager_id") != current_user["id"]:
            raise HTTPException(status_code=403, detail="Not authorized to approve this leave")
        update_fields["manager_approval"] = data.status
        update_fields["manager_reviewer_id"] = current_user["id"]
        update_fields["manager_reviewer_name"] = current_user["name"]
        update_fields["manager_read"] = True # I've just read and reacted to it
        update_fields["admin_read"] = False # Unread for admin now
        
    elif current_user["role"] == "admin":
        update_fields["admin_approval"] = data.status
        update_fields["admin_reviewer_id"] = current_user["id"]
        update_fields["admin_reviewer_name"] = current_user["name"]
        update_fields["admin_read"] = True # I've just read and reacted to it
        update_fields["manager_read"] = False # Unread for manager now
    else:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    # Determine overall status
    new_manager_approval = update_fields.get("manager_approval", leave.get("manager_approval"))
    new_admin_approval = update_fields.get("admin_approval", leave.get("admin_approval"))
    
    overall_status = "pending"
    if new_manager_approval == "rejected" or new_admin_approval == "rejected":
        overall_status = "rejected"
    elif new_manager_approval in ("approved", "not_required") and new_admin_approval == "approved":
        overall_status = "approved"
        
    update_fields["status"] = overall_status
    update_fields["is_read"] = False # Unread for the employee now!

    await db.leave_requests.update_one(
        {"id": leave_id},
        {"$set": update_fields}
    )
    doc = await db.leave_requests.find_one({"id": leave_id}, {"_id": 0})
    
    # Notify Employee
    emp_email = emp.get("email")
    if emp_email:
        background_tasks.add_task(send_leave_status_email, doc, emp_email, data.status, current_user["name"])
        
    return doc

# ── Balance ──

async def _get_balance(employee_id: str, year: int) -> dict:
    start = f"{year}-01-01"
    end = f"{year}-12-31"
    leaves = await db.leave_requests.find({
        "employee_id": employee_id,
        "status": {"$in": ["approved", "pending"]},
        "start_date": {"$gte": start, "$lte": end},
    }, {"_id": 0}).to_list(200)

    leave_used = 0
    lop_used = 0
    for l in leaves:
        days = await calc_days(l["start_date"], l["end_date"])
        leave_used += (days - l.get("lop_days", 0))
        lop_used += l.get("lop_days", 0)

    return {
        **LEAVE_ALLOCATION,
        "leave_used": leave_used,
        "lop_used": lop_used,
    }

@api_router.get("/leaves/balance/{employee_id}")
async def get_leave_balance(employee_id: str, year: Optional[int] = None, current_user: dict = Depends(get_current_user)):
    if current_user["role"] == "employee" and current_user["id"] != employee_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    if current_user["role"] == "manager" and current_user["id"] != employee_id:
        emp = await db.employees.find_one({"id": employee_id})
        if not emp or emp.get("manager_id") != current_user["id"]:
            raise HTTPException(status_code=403, detail="Not authorized")

    if year is None:
        year = datetime.now(timezone.utc).year
    balance = await _get_balance(employee_id, year)
    return balance

# ── Calendar ──

@api_router.get("/leaves/calendar")
async def get_calendar_data(month: int = Query(...), year: int = Query(...), current_user: dict = Depends(get_current_user)):
    start = f"{year}-{month:02d}-01"
    if month == 12:
        end = f"{year + 1}-01-01"
    else:
        end = f"{year}-{month + 1:02d}-01"

    query = {
        "status": "approved",
        "start_date": {"$lt": end},
        "end_date": {"$gte": start},
    }
    
    if current_user["role"] == "employee":
        query["employee_id"] = current_user["id"]
    elif current_user["role"] == "manager":
        assigned = await db.employees.find({"manager_id": current_user["id"]}, {"id": 1}).to_list(1000)
        assigned_ids = [e["id"] for e in assigned] + [current_user["id"]]
        query["employee_id"] = {"$in": assigned_ids}

    leaves = await db.leave_requests.find(query, {"_id": 0}).to_list(500)
    return leaves

# ── Holidays ──

@api_router.get("/holidays", response_model=List[Holiday])
async def list_holidays(current_user: dict = Depends(get_current_user)):
    docs = await db.holidays.find({}, {"_id": 0}).sort("date", 1).to_list(1000)
    return docs

@api_router.post("/holidays/upload")
async def upload_holidays(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only admin can upload holidays")
        
    content = await file.read()
    try:
        if file.filename.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(content))
        elif file.filename.endswith((".xls", ".xlsx")):
            df = pd.read_excel(io.BytesIO(content))
        else:
            raise HTTPException(status_code=400, detail="Invalid file format. Please upload CSV or Excel.")
            
        # Normalize column names 
        cols = {str(c).strip().lower(): str(c) for c in df.columns}
        
        date_col = None
        name_col = None
        for k, v in cols.items():
            if "date" in k:
                date_col = v
            elif "name" in k or "holiday" in k:
                name_col = v
                
        if not date_col or not name_col:
            raise HTTPException(status_code=400, detail="File must contain 'Date' and 'Holiday Name' columns.")
            
        inserted_count = 0
        for _, row in df.iterrows():
            date_val = row[date_col]
            name_val = row[name_col]
            
            if pd.isna(date_val) or pd.isna(name_val):
                continue
                
            try:
                if isinstance(date_val, pd.Timestamp):
                    date_str = date_val.strftime("%Y-%m-%d")
                else:
                    date_str = pd.to_datetime(str(date_val)).strftime("%Y-%m-%d")
            except Exception:
                continue
                
            hol = Holiday(name=str(name_val), date=date_str)
            await db.holidays.update_one(
                {"date": date_str},
                {"$set": hol.model_dump()},
                upsert=True
            )
            inserted_count += 1
            
        return {"message": f"Boom! {inserted_count} more reasons to celebrate are now on the calendar."}
    except Exception as e:
        logger.error(f"Error processing upload: {e}")
        raise HTTPException(status_code=400, detail=f"Error processing file: {str(e)}")

@api_router.delete("/holidays/{holiday_id}")
async def delete_holiday(holiday_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only admin can delete holidays")
    result = await db.holidays.delete_one({"id": holiday_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Holiday not found")
    return {"message": "Holiday deleted"}

# ── Dashboard ──


@api_router.get("/dashboard/stats")
async def get_dashboard_stats(current_user: dict = Depends(get_current_user)):
    if current_user["role"] == "employee":
        raise HTTPException(status_code=403, detail="Not authorized")
        
    query_emp = {}
    query_leaves = {}
    if current_user["role"] == "manager":
        assigned = await db.employees.find({"manager_id": current_user["id"]}, {"id": 1}).to_list(1000)
        assigned_ids = [e["id"] for e in assigned]
        query_emp = {"manager_id": current_user["id"]}
        query_leaves = {"employee_id": {"$in": assigned_ids}}

    total_employees = await db.employees.count_documents(query_emp)
    
    pending_query = {"status": "pending", **query_leaves}
    pending_count = await db.leave_requests.count_documents(pending_query)
    
    approved_today_query = {
        "status": "approved",
        "start_date": {"$lte": date.today().isoformat()},
        "end_date": {"$gte": date.today().isoformat()},
        **query_leaves
    }
    approved_today = await db.leave_requests.count_documents(approved_today_query)
    total_leaves = await db.leave_requests.count_documents(query_leaves)
    
    return {
        "total_employees": total_employees,
        "pending_requests": pending_count,
        "on_leave_today": approved_today,
        "total_requests": total_leaves,
    }

# ── Seed ──

@api_router.post("/seed")
async def seed_data():
    # Force reset if seeded with old format
    await db.employees.delete_many({})
    await db.leave_requests.delete_many({})
    
    pwd = get_password_hash("password123")

    employees_data = [
        {"id": "user_0", "name": "Priya Sharma", "email": "priya@company.com", "department": "HR", "role": "admin", "password_hash": pwd, "manager_id": None},
        {"id": "user_1", "name": "Raj Patel", "email": "raj@company.com", "department": "Engineering", "role": "manager", "password_hash": pwd, "manager_id": None},
        {"id": "user_2", "name": "Anita Desai", "email": "anita@company.com", "department": "Design", "role": "manager", "password_hash": pwd, "manager_id": None},
        {"id": "user_3", "name": "Vikram Singh", "email": "vikram@company.com", "department": "Engineering", "role": "employee", "password_hash": pwd, "manager_id": "user_1"},
        {"id": "user_4", "name": "Meera Nair", "email": "meera@company.com", "department": "Marketing", "role": "employee", "password_hash": pwd, "manager_id": "user_2"},
        {"id": "user_5", "name": "Arjun Reddy", "email": "arjun@company.com", "department": "Engineering", "role": "employee", "password_hash": pwd, "manager_id": "user_1"},
        {"id": "user_6", "name": "Kavita Iyer", "email": "kavita@company.com", "department": "Finance", "role": "employee", "password_hash": pwd, "manager_id": "user_1"},
        {"id": "user_7", "name": "Sanjay Gupta", "email": "sanjay@company.com", "department": "Marketing", "role": "employee", "password_hash": pwd, "manager_id": "user_2"},
        {"id": "user_8", "name": "Divya Menon", "email": "divya@company.com", "department": "Design", "role": "employee", "password_hash": pwd, "manager_id": "user_2"},
        {"id": "user_9", "name": "Rohan Joshi", "email": "rohan@company.com", "department": "Finance", "role": "employee", "password_hash": pwd, "manager_id": "user_2"},
    ]

    for ed in employees_data:
        emp = Employee(**ed)
        await db.employees.insert_one(emp.model_dump())

    # Create some sample leave requests
    today = date.today()
    sample_leaves = [
        {"employee_id": "user_3", "employee_name": "Vikram Singh", "leave_type": "leave", "category": "sick", "start_date": (today - timedelta(days=5)).isoformat(), "end_date": (today - timedelta(days=3)).isoformat(), "reason": "Fever and cold", "status": "approved", "manager_approval": "approved", "admin_approval": "approved", "manager_reviewer_id": "user_1", "manager_reviewer_name": "Raj Patel", "admin_reviewer_id": "user_0", "admin_reviewer_name": "Priya Sharma"},
        {"employee_id": "user_4", "employee_name": "Meera Nair", "leave_type": "leave", "category": "casual", "start_date": (today + timedelta(days=2)).isoformat(), "end_date": (today + timedelta(days=3)).isoformat(), "reason": "Family function", "status": "pending", "manager_approval": "pending", "admin_approval": "pending"},
        {"employee_id": "user_5", "employee_name": "Arjun Reddy", "leave_type": "leave", "category": "personal", "start_date": (today + timedelta(days=7)).isoformat(), "end_date": (today + timedelta(days=11)).isoformat(), "reason": "Vacation trip", "status": "pending", "manager_approval": "approved", "admin_approval": "pending", "manager_reviewer_id": "user_1", "manager_reviewer_name": "Raj Patel"},
        {"employee_id": "user_6", "employee_name": "Kavita Iyer", "leave_type": "leave", "category": "sick", "start_date": today.isoformat(), "end_date": (today + timedelta(days=1)).isoformat(), "reason": "Doctor appointment", "status": "approved", "manager_approval": "approved", "admin_approval": "approved", "manager_reviewer_id": "user_1", "manager_reviewer_name": "Raj Patel", "admin_reviewer_id": "user_0", "admin_reviewer_name": "Priya Sharma"},
        {"employee_id": "user_7", "employee_name": "Sanjay Gupta", "leave_type": "leave", "category": "casual", "start_date": (today - timedelta(days=1)).isoformat(), "end_date": today.isoformat(), "reason": "Personal work", "status": "approved", "manager_approval": "not_required", "admin_approval": "approved", "manager_reviewer_id": "user_2", "manager_reviewer_name": "Anita Desai", "admin_reviewer_id": "user_0", "admin_reviewer_name": "Priya Sharma"},
    ]

    for sl in sample_leaves:
        leave = LeaveRequest(**sl)
        await db.leave_requests.insert_one(leave.model_dump())

    return {"message": "Seeded successfully"}

# ── Root ──

@api_router.get("/")
async def root():
    return {"message": "Leave Management API"}

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)
