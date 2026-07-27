import mysql.connector

mydb=mysql.connector.connect(
    host="sakura.proxy.rlwy.net",
    port=22453,
    user="root",
    password="sZvCvKixocdVadmggqTHDvXOLEmHVNVu",
    database="railway"
)

mycursor = mydb.cursor()


def get_cursor():
    return mydb.cursor(dictionary=True)


mycursor.execute("SHOW TABLES")

result = mycursor.fetchall()
print(result)

