# Formulario para imputar horas del proyecto Minor



## Descripción General

Se quiere tener una nueva sección para que los empleados puedan indicar cuantas horas han trabajado semanalmente en los subproyectos de Minor. Para poder gestionarlo:


- Crear una nueva sección admin que permita a los admins que estén asignados al proyecto Minor administrar la lista de subproyectos. 
- Añadir un nuevo campo a los empleados para indicar cuantas horas deben imputar por semana. Por defecto el valor será 42.
- Crear un formulario para imputar horas con las siguientes caracteristicas:
	- Solo será accesible para empleados del proyecto Minor
	- El empleado accederá y verá la lista de subproyectos y el calendario por semanas del mes.
	- El calendario se mostrará mes a mes pudiendo avanzar entre los diferentes meses.
	- Las horas que impute el empleado semanalmente sumando todos los subproyectos deberán coincidir con el valor inidicado de horas a imputar por empleado que se puede configurar en su ficha.
	- Si una semana no suma las horas configuradas al empleado, marcar el total de la semana en rojo.
- Crear una vista para los administradores de Minor que permita:
	- Ver una tabla con la lista de empleados y los subproyectos con las horas imputadas de cada uno. 
	- Esta tabla será semanal y se podrá cambiar de semana a semana.
	- Se añadirá un botón para enviar una notificación slack indicando los empleados que no han completado las horas configuradas.


