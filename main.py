from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from pymongo import MongoClient
from typing import Optional, Dict, List
from reportlab.lib.pagesizes import letter, landscape
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib import colors
import bcrypt
import pandas as pd
import openpyxl
from io import BytesIO
from datetime import datetime
from fastapi import Depends
from bson import ObjectId
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont



app = FastAPI()

# CORS
origins = [
    "https://bestem.onrender.com",
    "https://bestemcatering.onrender.com",
    "https://cateringbestem.onrender.com",
    "https://catering-1.onrender.com",
    "http://localhost",
    "http://127.0.0.1",
    "http://localhost:5500",
    "null"
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB
client = MongoClient("mongodb+srv://Maciej:20250504@cateringAtlas.ivdqqew.mongodb.net/catering_app?retryWrites=true&w=majority")
db = client["catering_app"]
users_collection = db["users"]
orders_collection = db["orders"]
menu_collection = db["menu"]

# MODELE
class LoginUser(BaseModel):
    username: str
    password: str

class Meal(BaseModel):
    name: str
    price: float

class WeeklyOrder(BaseModel):
    username: str
    meals: Dict[str, List[Meal]]  # Klucz to dzień tygodnia, wartość to lista obiektów Meal
    week: str
    date_range: str


class MenuItem(BaseModel):
    name: str
    description: str
    price: float

class NewUserPayload(BaseModel):
    username: str
    password: str
    role: str
    admin_username: str
    user_code: str

class MenuPayload(BaseModel):
    name: str
    description: str
    price: float
    username: str

class MenuDeletePayload(BaseModel):
    name: str
    username: str

class DeleteOrderPayload(BaseModel):
    order_id: str
    admin_username: str

class DeleteOrdersPayload(BaseModel):
    order_ids: List[str]
    admin_username: str


# Funkcje haseł
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

# Endpointy

@app.post("/login")
def login(user: LoginUser):
    db_user = users_collection.find_one({"username": user.username})
    if not db_user or not verify_password(user.password, db_user["hashed_password"]):
        raise HTTPException(status_code=400, detail="Błędny login lub hasło")

    return {
        "msg": "Zalogowano",
        "username": db_user["username"],
        "role": db_user["role"],
        "user_code": db_user.get("user_code", "")  # Dodajemy user_code do odpowiedzi
    }

@app.post("/admin/add_user")
def add_user(payload: NewUserPayload):
    print(payload)  # Sprawdź, co przychodzi w żądaniu
    admin = users_collection.find_one({"username": payload.admin_username})
    if not admin or admin["role"] != "admin":
        raise HTTPException(status_code=403, detail="Brak dostępu")

    if users_collection.find_one({"username": payload.username}):
        raise HTTPException(status_code=400, detail="Użytkownik już istnieje")

    hashed_pw = hash_password(payload.password)
    users_collection.insert_one({
        "username": payload.username,
        "hashed_password": hashed_pw,
        "role": payload.role,
        "user_code": payload.user_code
    })
    return {"msg": f"Użytkownik {payload.username} dodany jako {payload.role}"}


@app.post("/menu")
def add_menu_item(payload: MenuPayload):
    user = users_collection.find_one({"username": payload.username})
    if not user or user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Brak uprawnień")

    menu_collection.insert_one({
        "name": payload.name,
        "description": payload.description,
        "price": payload.price
    })
    return {"msg": "Pozycja dodana do menu"}

@app.get("/menu/list")
def get_menu():
    return list(menu_collection.find({}, {"_id": 0}))

@app.delete("/menu/delete")
def delete_menu_item(payload: MenuDeletePayload):
    admin = users_collection.find_one({"username": payload.username})
    if not admin or admin["role"] != "admin":
        raise HTTPException(status_code=403, detail="Brak uprawnień")

    result = menu_collection.delete_one({"name": payload.name})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Pozycja nie istnieje")
    return {"msg": f"Usunięto pozycję {payload.name}"}

@app.delete("/admin/delete_user")
def delete_user(username: str, admin_username: str):
    admin = users_collection.find_one({"username": admin_username})
    if not admin or admin["role"] != "admin":
        raise HTTPException(status_code=403, detail="Brak dostępu")

    user = users_collection.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="Użytkownik nie istnieje")

    users_collection.delete_one({"username": username})

    return {"msg": f"Użytkownik {username} został usunięty"}

@app.post("/order/weekly")
def create_weekly_order(order: WeeklyOrder):
    user = users_collection.find_one({"username": order.username})
    if not user:
        raise HTTPException(status_code=400, detail="Użytkownik nie istnieje")

    # Zamówienie do zapisania
    order_data = order.dict()
    meals_data = []
    for day, meal_list in order.meals.items():
        for meal in meal_list:
            meals_data.append({
                "day": day,
                "name": meal.name,
                "price": meal.price
            })

    orders_collection.insert_one({
        "username": order.username,
        "meals": meals_data,
        "week": order.week,
        "date_range": order.date_range,
        "timestamp": datetime.utcnow()
    })
    return {"msg": "Zamówienie zapisane"}


from bson import ObjectId
from fastapi import HTTPException

from bson import ObjectId
from fastapi import HTTPException


@app.delete("/admin/delete_order")
async def delete_order(payload: DeleteOrderPayload):
    # Walidacja admina
    admin = users_collection.find_one({"username": payload.admin_username})
    if not admin or admin["role"] != "admin":
        raise HTTPException(status_code=403, detail="Brak uprawnień")

    # Konwersja stringa na ObjectId MongoDB
    try:
        object_id = ObjectId(payload.order_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Nieprawidłowy format ID: {str(e)}")

    # Usuwanie po _id (ObjectId)
    result = orders_collection.delete_one({"_id": object_id})

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Zamówienie nie istnieje")

    return {"status": "success", "message": f"Zamówienie {payload.order_id} usunięte"}

@app.get("/order/history")
def get_user_orders(username: str):
    user = users_collection.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=403, detail="Brak użytkownika")
    return list(orders_collection.find({"username": username}, {"_id": 0}))

@app.put("/admin/change_password")
def change_password(username: str, new_password: str, admin_username: str):
    admin = users_collection.find_one({"username": admin_username})
    if not admin or admin["role"] != "admin":
        raise HTTPException(status_code=403, detail="Brak dostępu")

    user = users_collection.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="Użytkownik nie istnieje")

    hashed_password = hash_password(new_password)
    users_collection.update_one({"username": username}, {"$set": {"hashed_password": hashed_password}})

    return {"msg": f"Hasło użytkownika {username} zostało zmienione."}

@app.get("/admin/users")
def get_users(admin_username: str):
    admin = users_collection.find_one({"username": admin_username})
    if not admin or admin["role"] != "admin":
        raise HTTPException(status_code=403, detail="Brak dostępu")

    users = list(users_collection.find({}, {"_id": 0, "hashed_password": 0}))
    return users

@app.put("/admin/update_role")
def update_role(username: str, new_role: str, admin_username: str):
    admin = users_collection.find_one({"username": admin_username})
    if not admin or admin["role"] != "admin":
        raise HTTPException(status_code=403, detail="Brak dostępu")

    user = users_collection.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="Użytkownik nie istnieje")

    if new_role not in ["user", "admin"]:
        raise HTTPException(status_code=400, detail="Nieprawidłowa rola")

    users_collection.update_one({"username": username}, {"$set": {"role": new_role}})

    return {"msg": f"Rola użytkownika {username} została zmieniona na {new_role}"}

# Nowy endpoint do pobrania raportu zamówień w formacie Excel
@app.get("/admin/orders/excel")
def export_orders_excel(admin_username: str):
    # Walidacja uprawnień administratora
    admin = users_collection.find_one({"username": admin_username})
    if not admin or admin["role"] != "admin":
        raise HTTPException(status_code=403, detail="Brak uprawnień administratora")

    # Pobierz zamówienia
    orders = list(orders_collection.find({}))
    if not orders:
        raise HTTPException(status_code=404, detail="Brak zamówień do eksportu")

    # Przygotuj dane
    rows = []
    days_of_week = ["Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek"]

    for order in orders:
        # Pobierz kod użytkownika
        user = users_collection.find_one({"username": order["username"]})
        user_code = user.get("user_code", "") if user else ""

        # Inicjalizuj struktury dla dan i cen
        meals_by_day = {day: [] for day in days_of_week}
        prices_by_day = {day: 0.0 for day in days_of_week}

        # Grupuj dania i sumuj ceny według dnia
        for meal in order.get("meals", []):
            day = meal["day"]
            if day in meals_by_day:
                meals_by_day[day].append(meal['name'])
                prices_by_day[day] += float(meal['price'])

        # Przygotuj wiersz danych
        row = {
            "ID zamówienia": str(order["_id"]),
            "Kod użytkownika": user_code,
            "Użytkownik": order["username"],
            "Miejsce": order.get("date_range", ""),
            "Tydzień": order["week"],
            "Data zamówienia": order.get("timestamp", "").strftime("%Y-%m-%d %H:%M:%S") if order.get(
                "timestamp") else "",

        }

        # Dodaj kolumny dla każdego dnia (dania i ceny)
        for day in days_of_week:
            # Kolumna z daniami
            row[f"{day} - danie"] = ", ".join(meals_by_day[day]) if meals_by_day[day] else "Brak"
            # Kolumna z ceną (tylko wartość liczbowa)
            row[f"{day} - cena"] = prices_by_day[day] if prices_by_day[day] > 0 else 0.0

        rows.append(row)

    # Utwórz DataFrame
    df = pd.DataFrame(rows)

    # Utwórz plik Excel w pamięci
    output = BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='Zamówienia')
        worksheet = writer.sheets['Zamówienia']

        # Formatowanie kolumn z cenami jako waluta
        for col_idx, column in enumerate(df.columns, 1):
            if "cena" in column:
                # Ustaw formatowanie walutowe dla kolumn z cenami
                for row in range(2, len(df) + 2):
                    worksheet.cell(row=row, column=col_idx).number_format = '#,##0.00" zł"'

            # Dostosuj szerokość kolumn
            column_width = max(df[column].astype(str).map(len).max(), len(column)) + 2
            worksheet.column_dimensions[openpyxl.utils.get_column_letter(col_idx)].width = column_width

    output.seek(0)

    # Ustaw nagłówki odpowiedzi
    headers = {
        "Content-Disposition": "attachment; filename=raport_zamowien.xlsx",
        "Access-Control-Expose-Headers": "Content-Disposition"
    }

    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers=headers
    )

@app.get("/admin/orders")
def get_all_orders(admin_username: str):
    admin = users_collection.find_one({"username": admin_username})
    if not admin or admin["role"] != "admin":
        raise HTTPException(status_code=403, detail="Brak uprawnień")

    try:
        orders = list(orders_collection.find({}))

        # Konwersja ObjectId na string dla każdego zamówienia
        for order in orders:
            order["_id"] = str(order["_id"])

        return orders

    except Exception as e:
        print(f"Błąd w /admin/orders: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Błąd serwera: {str(e)}")

@app.delete("/admin/delete_orders")
async def delete_orders(payload: DeleteOrdersPayload):
    # Walidacja admina
    admin = users_collection.find_one({"username": payload.admin_username})
    if not admin or admin["role"] != "admin":
        raise HTTPException(status_code=403, detail="Brak uprawnień")

    # Konwersja stringów na ObjectId
    try:
        object_ids = [ObjectId(order_id) for order_id in payload.order_ids]
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Nieprawidłowy format ID: {str(e)}")

    # Usuwanie wielu zamówień
    result = orders_collection.delete_many({"_id": {"$in": object_ids}})

    return {
        "status": "success",
        "message": f"Usunięto {result.deleted_count} zamówień",
        "deleted_count": result.deleted_count
    }


@app.get("/admin/orders/pdf")
def export_orders_pdf(admin_username: str):
    # Walidacja uprawnień administratora
    admin = users_collection.find_one({"username": admin_username})
    if not admin or admin["role"] != "admin":
        raise HTTPException(status_code=403, detail="Brak uprawnień administratora")

    try:
        # Pobierz zamówienia
        orders = list(orders_collection.find({}))
        if not orders:
            raise HTTPException(status_code=404, detail="Brak zamówień do eksportu")

        # Utwórz PDF w pamięci z orientacją poziomą
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=landscape(letter))

        # Zarejestruj czcionkę (ważne dla polskich znaków)
        try:
            pdfmetrics.registerFont(TTFont('DejaVu', 'DejaVuSans.ttf'))
            styles = getSampleStyleSheet()
            styles['Normal'].fontName = 'DejaVu'
        except:
            print("Uwaga: Czcionka DejaVu nie została zarejestrowana, używam domyślnej")

        # Inicjalizacja elementów dokumentu
        elements = []
        styles = getSampleStyleSheet()

        # Tytuł
        title = Paragraph(f"Raport zamówień - {datetime.now().strftime('%Y-%m-%d')}", styles['Title'])
        elements.append(title)

        # Przygotuj dane
        data = []
        headers = [
            "Nazwisko Imie",
            "RCP",
            "Tydzień",
            "Zakres dat",
            "Poniedziałek",
            "Wtorek",
            "Środa",
            "Czwartek",
            "Piątek"
        ]
        data.append(headers)

        for order in orders:
            # Pobierz kod użytkownika
            user = users_collection.find_one({"username": order["username"]})
            user_code = user.get("user_code", "") if user else ""

            # Grupuj dania według dnia
            meals_by_day = {day: [] for day in headers[4:]}
            for meal in order.get("meals", []):
                day = meal["day"]
                if day in meals_by_day:
                    meals_by_day[day].append(f"{meal['name']} ({meal['price']:.2f} zł)")

            # Przygotuj wiersz danych
            row = [
                user_code,
                order["username"],
                order["week"],
                order.get("date_range", "Brak danych"),
                "\n".join(meals_by_day["Poniedziałek"]) or "-",
                "\n".join(meals_by_day["Wtorek"]) or "-",
                "\n".join(meals_by_day["Środa"]) or "-",
                "\n".join(meals_by_day["Czwartek"]) or "-",
                "\n".join(meals_by_day["Piątek"]) or "-"
            ]
            data.append(row)

        # Szerokości kolumn
        col_widths = [80, 60, 50, 80] + [70] * 5  # Suma 9 kolumn

        # Tabela
        table = Table(data, colWidths=col_widths, repeatRows=1)

        # Style tabeli
        style = TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#3a86ff')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 8),
            ('FONTSIZE', (0, 1), (-1, -1), 7),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
            ('BACKGROUND', (0, 1), (-1, -1), colors.white),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.lightgrey),
            ('VALIGN', (0, 0), (-1, -1), 'TOP')
        ])

        # Alternatywne kolory wierszy
        for i in range(1, len(data)):
            if i % 2 == 0:
                style.add('BACKGROUND', (0, i), (-1, i), colors.HexColor('#f8f9fa'))

        table.setStyle(style)
        elements.append(table)

        # Zbuduj dokument
        doc.build(elements)
        buffer.seek(0)

        # Ustaw nagłówki odpowiedzi
        headers = {
            "Content-Disposition": f"attachment; filename=raport_zamowien_{datetime.now().strftime('%Y-%m-%d')}.pdf",
            "Access-Control-Expose-Headers": "Content-Disposition"
        }

        return StreamingResponse(
            buffer,
            media_type="application/pdf",
            headers=headers
        )

    except Exception as e:
        print(f"Błąd podczas generowania PDF: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Błąd generowania PDF: {str(e)}")

@app.get("/admin/orders/erp")
def export_orders_erp(admin_username: str):
    # Walidacja uprawnień administratora
    admin = users_collection.find_one({"username": admin_username})
    if not admin or admin["role"] != "admin":
        raise HTTPException(status_code=403, detail="Brak uprawnień administratora")

    # Pobierz zamówienia
    orders = list(orders_collection.find({}))
    if not orders:
        raise HTTPException(status_code=404, detail="Brak zamówień do eksportu")

    # Przygotuj dane w formacie CSV
    output = BytesIO()

    # Nagłówki kolumn
    headers = "username;total_price;week"
    output.write(headers.encode('utf-8'))

    for order in orders:
        # Oblicz sumę cen (zaokrągloną do 2 miejsc po przecinku)
        total_price = round(sum(meal['price'] for meal in order.get("meals", [])), 2)

        # Przygotuj wiersz danych - total_price jako liczba bez dodatkowych oznaczeń i .0 dla liczb całkowitych
        if total_price % 1 == 0:
            total_price = int(total_price)  # Usuń .0 dla liczb całkowitych
        row = f"\n{order['username']};{total_price};{order['week']}"
        output.write(row.encode('utf-8'))

    output.seek(0)

    # Ustaw nagłówki odpowiedzi
    headers = {
        "Content-Disposition": "attachment; filename=raport_erp.csv",
        "Access-Control-Expose-Headers": "Content-Disposition",
        "Content-Type": "text/csv; charset=utf-8"
    }

    return StreamingResponse(
        output,
        media_type="text/csv",
        headers=headers
    )
